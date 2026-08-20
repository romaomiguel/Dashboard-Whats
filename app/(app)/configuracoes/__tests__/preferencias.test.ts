import { beforeEach, describe, expect, it, vi } from 'vitest'
import { salvarPreferencia } from '@/app/(app)/configuracoes/actions'

const banco = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  erro: null as { message: string } | null,
  updates: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: banco.usuario } }) },
    from: () => ({
      update: (valores: Record<string, unknown>) => ({
        eq: async (_coluna: string, id: string) => {
          banco.updates.push({ valores, id })
          return { error: banco.erro }
        },
      }),
    }),
  }),
}))

beforeEach(() => {
  banco.usuario = { id: 'user-1' }
  banco.erro = null
  banco.updates = []
})

describe('salvarPreferencia', () => {
  it('grava na coluna do tipo escolhido', async () => {
    const estado = await salvarPreferencia('mensagem', false)

    expect(estado).toEqual({ ok: true })
    expect(banco.updates[0]).toEqual({
      valores: { notificar_mensagem: false },
      id: 'user-1',
    })
  })

  it('cada tipo tem a sua coluna', async () => {
    await salvarPreferencia('disparo', true)
    await salvarPreferencia('conexao', false)

    expect(banco.updates[0].valores).toEqual({ notificar_disparo: true })
    expect(banco.updates[1].valores).toEqual({ notificar_conexao: false })
  })

  // O tipo vem da tela; aceitar qualquer string viraria nome de coluna.
  it('recusa tipo desconhecido sem tocar no banco', async () => {
    const estado = await salvarPreferencia(
      'invalido' as never,
      true,
    )

    expect(estado.erro).toMatch(/desconhecido/)
    expect(banco.updates).toHaveLength(0)
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await salvarPreferencia('mensagem', true)

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.updates).toHaveLength(0)
  })

  it('reporta falha do banco sem vazar a mensagem interna', async () => {
    banco.erro = { message: 'violates row-level security policy' }
    const estado = await salvarPreferencia('mensagem', true)

    expect(estado.erro).toBe('Não foi possível salvar a preferência.')
  })
})
