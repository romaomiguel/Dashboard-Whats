import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'

const banco = vi.hoisted(() => ({
  perfil: {
    notificar_mensagem: true,
    notificar_disparo: true,
    notificar_conexao: true,
  } as Record<string, boolean>,
  upserts: [] as { valores: Record<string, unknown>; opcoes: unknown }[],
  deletes: [] as Record<string, unknown>[],
  erroUpsert: null as { message: string } | null,
  // 'rejeita' simula o delete rejeitando a promise de verdade (não apenas
  // resolvendo com {error}), que é o caminho que faltava proteção.
  erroDelete: null as { message: string } | 'rejeita' | null,
}))

function clienteFalso() {
  return {
    from(tabela: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: banco.perfil }),
          }),
        }),
        upsert: async (valores: Record<string, unknown>, opcoes: unknown) => {
          banco.upserts.push({ valores, opcoes })
          return { error: banco.erroUpsert }
        },
        delete: () => {
          const filtros: Record<string, unknown> = { tabela }
          const encadeado = {
            eq(coluna: string, valor: unknown) {
              filtros[coluna] = valor
              return encadeado
            },
            lt(coluna: string, valor: unknown) {
              filtros[coluna] = valor
              banco.deletes.push(filtros)
              return encadeado
            },
            then(
              resolver: (r: { error: unknown }) => void,
              rejeitar?: (erro: unknown) => void,
            ) {
              if (banco.erroDelete === 'rejeita') {
                rejeitar?.(new Error('conexão caiu'))
                return
              }
              resolver({ error: banco.erroDelete })
            },
          }
          return encadeado
        },
      }
    },
  } as never
}

const mensagem = {
  tipo: 'mensagem' as const,
  numero: '556584627628',
  nome: 'Amanda',
  texto: 'Oi',
}

beforeEach(() => {
  banco.perfil = {
    notificar_mensagem: true,
    notificar_disparo: true,
    notificar_conexao: true,
  }
  banco.upserts = []
  banco.deletes = []
  banco.erroUpsert = null
  banco.erroDelete = null
})

describe('registrarNotificacao', () => {
  it('grava amarrada ao dono, com a chave montada', async () => {
    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(gravou).toBe(true)
    expect(banco.upserts[0].valores).toMatchObject({
      owner_id: 'user-1',
      tipo: 'mensagem',
      chave: 'mensagem:556584627628',
      titulo: 'Amanda respondeu',
      lida: false,
    })
  })

  // Desligado significa não criar, não criar e esconder: senão o desligado
  // acumularia linha no banco à toa.
  it('preferência desligada não grava nada', async () => {
    banco.perfil.notificar_mensagem = false

    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(gravou).toBe(false)
    expect(banco.upserts).toHaveLength(0)
  })

  it('cada tipo consulta a sua própria preferência', async () => {
    banco.perfil.notificar_mensagem = false

    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', {
      tipo: 'conexao',
      id: 'c1',
      nome: 'Comercial',
    })

    expect(gravou).toBe(true)
  })

  it('atividade nova na mesma chave volta a marcar como não lida', async () => {
    await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(banco.upserts[0].valores).toMatchObject({ lida: false })
    expect(banco.upserts[0].opcoes).toEqual({ onConflict: 'owner_id,chave' })
  })

  it('limpa as lidas antigas do próprio dono, sem depender de cron', async () => {
    await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    const limpeza = banco.deletes.at(-1)
    expect(limpeza).toMatchObject({ owner_id: 'user-1', lida: true })
    expect(typeof limpeza!.atualizado_em).toBe('string')
  })

  it('perfil sem colunas de preferência não impede notificar', async () => {
    // Migration 0012 ainda não rodada: melhor notificar do que sumir calado.
    banco.perfil = {}

    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(gravou).toBe(true)
  })

  it('erro no upsert devolve false, sem lançar', async () => {
    banco.erroUpsert = { message: 'falhou' }

    await expect(
      registrarNotificacao(clienteFalso(), 'user-1', mensagem),
    ).resolves.toBe(false)
  })

  // A notificação já foi gravada quando a retenção roda: uma falha ali não
  // pode subir como exceção nem apagar o `true` já conquistado, senão o
  // webhook devolveria erro para a Evolution (que reenvia em laço) ou um
  // disparo pararia no meio do lote.
  it('erro na retenção não derruba a chamada nem muda o true já gravado', async () => {
    banco.erroDelete = 'rejeita'

    await expect(
      registrarNotificacao(clienteFalso(), 'user-1', mensagem),
    ).resolves.toBe(true)
  })
})
