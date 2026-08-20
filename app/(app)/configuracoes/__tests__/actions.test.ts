import { beforeEach, describe, expect, it, vi } from 'vitest'
import { salvarPerfil } from '@/app/(app)/configuracoes/actions'

const supabaseFalso = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  erroUpdate: null as { message: string } | null,
  chamadas: [] as { nome: string; id: string }[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: {
      getUser: async () => ({ data: { user: supabaseFalso.usuario } }),
    },
    from: () => ({
      update: (valores: { nome: string }) => ({
        eq: async (_coluna: string, id: string) => {
          supabaseFalso.chamadas.push({ nome: valores.nome, id })
          return { error: supabaseFalso.erroUpdate }
        },
      }),
    }),
  }),
}))

function form(nome: string) {
  const dados = new FormData()
  dados.set('nome', nome)
  return dados
}

beforeEach(() => {
  supabaseFalso.usuario = { id: 'user-1' }
  supabaseFalso.erroUpdate = null
  supabaseFalso.chamadas = []
})

describe('salvarPerfil', () => {
  it('grava o nome no perfil do próprio usuário', async () => {
    const estado = await salvarPerfil({}, form('Maria Silva'))

    expect(estado).toEqual({ ok: true })
    expect(supabaseFalso.chamadas).toEqual([{ nome: 'Maria Silva', id: 'user-1' }])
  })

  it('remove espaços nas pontas', async () => {
    await salvarPerfil({}, form('  Maria  '))
    expect(supabaseFalso.chamadas[0].nome).toBe('Maria')
  })

  it('recusa nome acima de 80 caracteres sem tocar no banco', async () => {
    const estado = await salvarPerfil({}, form('a'.repeat(81)))

    expect(estado.erro).toMatch(/80 caracteres/)
    expect(supabaseFalso.chamadas).toHaveLength(0)
  })

  it('recusa quando não há sessão', async () => {
    supabaseFalso.usuario = null
    const estado = await salvarPerfil({}, form('Maria'))

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(supabaseFalso.chamadas).toHaveLength(0)
  })

  it('reporta falha do banco sem vazar a mensagem interna', async () => {
    supabaseFalso.erroUpdate = { message: 'violates row-level security policy' }
    const estado = await salvarPerfil({}, form('Maria'))

    expect(estado.erro).toBe('Não foi possível salvar. Tente de novo.')
  })
})
