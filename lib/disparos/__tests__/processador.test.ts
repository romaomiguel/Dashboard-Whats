import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { processarLote } from '@/lib/disparos/processador'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'

// A Evolution nunca é chamada de verdade: só interessa aqui se o lote
// notifica na virada para concluído, não se o envio funciona.
vi.mock('@/lib/evolution/client', () => ({
  chamar: vi.fn(async () => ({ key: { id: 'wamid_teste' } })),
}))

vi.mock('@/lib/notificacoes/registrar', () => ({
  registrarNotificacao: vi.fn(async () => true),
}))

const registrarNotificacaoMock = vi.mocked(registrarNotificacao)

type Estado = {
  instancia: { id: string; owner_id: string; evolution_name: string } | null
  pendentes: { id: string; numero: string; nome: string | null }[]
  contagens: Record<'enviado' | 'falhou' | 'pendente', number>
  campanha: { nome: string; total: number } | null
  atualizacoesDisparo: Record<string, unknown>[]
}

function estadoPadrao(): Estado {
  return {
    instancia: { id: 'inst-1', owner_id: 'user-1', evolution_name: 'inst_a1b2c3d4' },
    pendentes: [{ id: 'env-1', numero: '5511999999999', nome: 'Ana' }],
    contagens: { enviado: 1, falhou: 0, pendente: 0 },
    campanha: { nome: 'Campanha teste', total: 1 },
    atualizacoesDisparo: [],
  }
}

/**
 * Réplica mínima do encadeamento do PostgREST usado por `processarLote`.
 *
 * Só cobre `instances`, `disparo_envios` e `disparos` nas formas exatas em
 * que o processador consulta: select simples, select com `count`, update e
 * insert, sempre terminando num `.eq()`/`.limit()`/`.maybeSingle()` que o
 * código de verdade também usa. Um `then` genérico cobre o caso de `await`
 * direto sem `.maybeSingle()`.
 */
function construirConsulta(tabela: string, estado: Estado) {
  const filtros: Record<string, unknown> = {}
  let modo: 'select' | 'update' | 'insert' = 'select'
  let comContagem = false
  let limite: number | null = null

  const api = {
    select(_colunas: string, opcoes?: { count?: string; head?: boolean }) {
      modo = 'select'
      comContagem = Boolean(opcoes?.count)
      return api
    },
    update(valores: Record<string, unknown>) {
      modo = 'update'
      if (tabela === 'disparos') estado.atualizacoesDisparo.push(valores)
      return api
    },
    insert(_valores: Record<string, unknown>) {
      modo = 'insert'
      return api
    },
    eq(coluna: string, valor: unknown) {
      filtros[coluna] = valor
      return api
    },
    limit(n: number) {
      limite = n
      return api
    },
    async maybeSingle() {
      return resolver()
    },
    then(resolve: (r: unknown) => void, reject?: (e: unknown) => void) {
      return resolver().then(resolve, reject)
    },
  }

  async function resolver(): Promise<{ data?: unknown; error?: unknown; count?: number }> {
    if (tabela === 'instances') return { data: estado.instancia }

    if (tabela === 'disparo_envios') {
      if (modo === 'update') return { error: null }
      if (comContagem) {
        const status = filtros.status as 'enviado' | 'falhou' | 'pendente'
        return { count: estado.contagens[status] ?? 0 }
      }
      return { data: estado.pendentes.slice(0, limite ?? estado.pendentes.length) }
    }

    if (tabela === 'disparos') {
      if (modo === 'update') return { error: null }
      return { data: estado.campanha }
    }

    if (tabela === 'mensagens') return { error: null }

    return { data: null, error: null }
  }

  return api
}

function clienteFalso(estado: Estado): SupabaseClient {
  return { from: (tabela: string) => construirConsulta(tabela, estado) } as never
}

const disparoBase = {
  id: 'disparo-1',
  mensagem: 'Oi pessoal',
  instance_id: 'inst-1',
  status: 'enviando',
}

/** Roda o lote destravando o `dormir` entre envios sem esperar de verdade. */
async function rodar(estado: Estado) {
  const db = clienteFalso(estado)
  const promise = processarLote(db, disparoBase)
  await vi.runAllTimersAsync()
  return { db, resultado: await promise }
}

describe('processarLote — notificação de campanha concluída', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('lote que zera os pendentes notifica uma vez, com nome, enviados e total corretos', async () => {
    const estado = estadoPadrao()
    estado.contagens = { enviado: 5, falhou: 0, pendente: 0 }
    estado.campanha = { nome: 'Campanha teste', total: 5 }

    const { db, resultado } = await rodar(estado)

    expect(resultado).not.toBeNull()
    expect(resultado?.restantes).toBe(0)
    expect(registrarNotificacaoMock).toHaveBeenCalledTimes(1)
    expect(registrarNotificacaoMock).toHaveBeenCalledWith(db, 'user-1', {
      tipo: 'disparo',
      id: 'disparo-1',
      nome: 'Campanha teste',
      enviados: 5,
      total: 5,
    })
  })

  it('lote que deixa pendentes não notifica', async () => {
    const estado = estadoPadrao()
    estado.contagens = { enviado: 2, falhou: 0, pendente: 3 }

    const { resultado } = await rodar(estado)

    expect(resultado).not.toBeNull()
    expect(resultado?.restantes).toBe(3)
    expect(registrarNotificacaoMock).not.toHaveBeenCalled()
    // Some pra 'enviando', nunca 'concluido', enquanto sobrar pendente.
    expect(estado.atualizacoesDisparo.at(-1)).toMatchObject({ status: 'enviando' })
  })

  // registrarNotificacao nunca lança (contrato de lib/notificacoes/registrar.ts);
  // aqui confirmamos que o processador também não trata o `false` dela como
  // motivo para mudar o resultado do lote nem interromper o fluxo.
  it('falha ao notificar não derruba o processamento nem muda o resultado do lote', async () => {
    registrarNotificacaoMock.mockResolvedValueOnce(false)
    const estado = estadoPadrao()
    estado.contagens = { enviado: 1, falhou: 0, pendente: 0 }
    estado.campanha = { nome: 'Campanha teste', total: 1 }

    const { resultado } = await rodar(estado)

    expect(resultado).toEqual({
      disparo: 'disparo-1',
      enviados: 1,
      falhas: 0,
      restantes: 0,
    })
    expect(registrarNotificacaoMock).toHaveBeenCalledTimes(1)
    expect(estado.atualizacoesDisparo.at(-1)).toMatchObject({ status: 'concluido' })
  })
})
