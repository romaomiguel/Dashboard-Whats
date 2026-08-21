import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  limparTodas,
  marcarComoLida,
  marcarTodasComoLidas,
} from '@/app/(app)/notificacoes/actions'

const banco = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  erro: null as { message: string } | null,
  updates: [] as Record<string, unknown>[],
  deletes: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: banco.usuario } }) },
    from: () => ({
      delete: () => {
        const filtros: Record<string, unknown> = {}
        const encadeado = {
          eq(coluna: string, valor: unknown) {
            filtros[coluna] = valor
            banco.deletes = banco.deletes.filter((d) => d !== filtros)
            banco.deletes.push(filtros)
            return encadeado
          },
          then(resolver: (r: { error: unknown }) => void) {
            resolver({ error: banco.erro })
          },
        }
        return encadeado
      },
      update: (valores: Record<string, unknown>) => {
        const filtros: Record<string, unknown> = { valores }
        const encadeado = {
          eq(coluna: string, valor: unknown) {
            filtros[coluna] = valor
            banco.updates = banco.updates.filter((u) => u !== filtros)
            banco.updates.push(filtros)
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

beforeEach(() => {
  banco.usuario = { id: 'user-1' }
  banco.erro = null
  banco.updates = []
  banco.deletes = []
})

describe('marcarComoLida', () => {
  it('marca só a escolhida, filtrando por dono', async () => {
    const estado = await marcarComoLida('n1')

    expect(estado).toEqual({ ok: true })
    expect(banco.updates.at(-1)).toMatchObject({
      id: 'n1',
      owner_id: 'user-1',
      valores: { lida: true },
    })
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await marcarComoLida('n1')

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.updates).toHaveLength(0)
  })
})

describe('marcarTodasComoLidas', () => {
  it('marca as não lidas do dono, sem varrer as já lidas', async () => {
    const estado = await marcarTodasComoLidas()

    expect(estado).toEqual({ ok: true })
    expect(banco.updates.at(-1)).toMatchObject({
      owner_id: 'user-1',
      lida: false,
      valores: { lida: true },
    })
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await marcarTodasComoLidas()

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.updates).toHaveLength(0)
  })
})

describe('limparTodas', () => {
  // O sino só sabia marcar como lida: as linhas continuavam no painel e o
  // acúmulo não tinha saída pela interface.
  it('apaga as do dono', async () => {
    const estado = await limparTodas()

    expect(estado).toEqual({ ok: true })
    expect(banco.deletes.at(-1)).toMatchObject({ owner_id: 'user-1' })
  })

  // Sem o filtro por dono, um delete sem `eq` varreria a tabela inteira.
  it('nunca apaga sem filtrar por dono', async () => {
    await limparTodas()

    expect(Object.keys(banco.deletes.at(-1) ?? {})).toContain('owner_id')
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await limparTodas()

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.deletes).toHaveLength(0)
  })

  it('avisa quando o banco recusa', async () => {
    banco.erro = { message: 'sem permissão' }
    const estado = await limparTodas()

    expect(estado.erro).toMatch(/Não foi possível limpar/)
  })
})
