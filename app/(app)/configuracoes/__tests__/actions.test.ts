import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  criarEtiqueta,
  excluirEtiqueta,
  salvarPerfil,
} from '@/app/(app)/configuracoes/actions'

const banco = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  erro: null as { message: string; code?: string } | null,
  upserts: [] as { tabela: string; valores: Record<string, unknown> }[],
  inserts: [] as { tabela: string; valores: Record<string, unknown> }[],
  deletes: [] as { tabela: string; filtros: Record<string, string> }[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: banco.usuario } }) },
    from: (tabela: string) => ({
      upsert: async (valores: Record<string, unknown>) => {
        banco.upserts.push({ tabela, valores })
        return { error: banco.erro }
      },
      insert: async (valores: Record<string, unknown>) => {
        banco.inserts.push({ tabela, valores })
        return { error: banco.erro }
      },
      delete: () => {
        const filtros: Record<string, string> = {}
        const encadeado = {
          eq(coluna: string, valor: string) {
            filtros[coluna] = valor
            banco.deletes = banco.deletes.filter((d) => d.filtros !== filtros)
            banco.deletes.push({ tabela, filtros })
            return encadeado
          },
          then(resolver: (r: { error: unknown }) => void) {
            resolver({ error: banco.erro })
          },
        }
        return encadeado
      },
    }),
  }),
}))

function form(campos: Record<string, string>) {
  const dados = new FormData()
  for (const [chave, valor] of Object.entries(campos)) dados.set(chave, valor)
  return dados
}

beforeEach(() => {
  banco.usuario = { id: 'user-1' }
  banco.erro = null
  banco.upserts = []
  banco.inserts = []
  banco.deletes = []
})

describe('salvarPerfil', () => {
  it('grava o nome com upsert, para conta sem linha em profiles', async () => {
    const estado = await salvarPerfil({}, form({ nome: 'Maria Silva' }))

    expect(estado).toEqual({ ok: true })
    expect(banco.upserts).toEqual([
      { tabela: 'profiles', valores: { id: 'user-1', nome: 'Maria Silva' } },
    ])
  })

  it('remove espaços nas pontas', async () => {
    await salvarPerfil({}, form({ nome: '  Maria  ' }))
    expect(banco.upserts[0].valores.nome).toBe('Maria')
  })

  it('recusa nome acima de 80 caracteres sem tocar no banco', async () => {
    const estado = await salvarPerfil({}, form({ nome: 'a'.repeat(81) }))

    expect(estado.erro).toMatch(/80 caracteres/)
    expect(banco.upserts).toHaveLength(0)
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await salvarPerfil({}, form({ nome: 'Maria' }))

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.upserts).toHaveLength(0)
  })

  it('reporta falha do banco sem vazar a mensagem interna', async () => {
    banco.erro = { message: 'violates row-level security policy' }
    const estado = await salvarPerfil({}, form({ nome: 'Maria' }))

    expect(estado.erro).toBe('Não foi possível salvar. Tente de novo.')
  })
})

describe('criarEtiqueta', () => {
  it('grava nome e cor amarrados ao dono', async () => {
    const estado = await criarEtiqueta({}, form({ nome: 'Orçamento', cor: 'roxo' }))

    expect(estado).toEqual({ ok: true })
    expect(banco.inserts).toEqual([
      {
        tabela: 'etiquetas',
        valores: { owner_id: 'user-1', nome: 'Orçamento', cor: 'roxo' },
      },
    ])
  })

  it('recusa nome vazio', async () => {
    const estado = await criarEtiqueta({}, form({ nome: '   ', cor: 'verde' }))

    expect(estado.erro).toMatch(/nome/i)
    expect(banco.inserts).toHaveLength(0)
  })

  it('recusa nome longo demais', async () => {
    const estado = await criarEtiqueta({}, form({ nome: 'a'.repeat(25), cor: 'verde' }))

    expect(estado.erro).toMatch(/24 caracteres/)
    expect(banco.inserts).toHaveLength(0)
  })

  // A carga aqui é de propósito uma string qualquer, e não algo com forma de
  // classe do Tailwind: o scanner do Tailwind lê os fontes do projeto, e uma
  // classe escrita num teste vira regra de verdade na folha de estilo.
  it('recusa cor fora da lista, para não gravar CSS arbitrário', async () => {
    const estado = await criarEtiqueta({}, form({ nome: 'X', cor: 'vermelho-neon' }))

    expect(estado.erro).toMatch(/cor da lista/)
    expect(banco.inserts).toHaveLength(0)
  })

  it('explica quando a etiqueta já existe', async () => {
    banco.erro = { message: 'duplicate key', code: '23505' }
    const estado = await criarEtiqueta({}, form({ nome: 'VIP', cor: 'verde' }))

    expect(estado.erro).toBe('Você já tem a etiqueta "VIP".')
  })
})

describe('excluirEtiqueta', () => {
  it('filtra por id e por dono', async () => {
    const estado = await excluirEtiqueta('etq-9')

    expect(estado).toEqual({ ok: true })
    expect(banco.deletes.at(-1)).toEqual({
      tabela: 'etiquetas',
      filtros: { id: 'etq-9', owner_id: 'user-1' },
    })
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await excluirEtiqueta('etq-9')

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.deletes).toHaveLength(0)
  })
})
