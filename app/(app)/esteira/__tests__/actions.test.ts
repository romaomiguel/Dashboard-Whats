import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarEtapa, moverContato } from '@/app/(app)/esteira/actions'

const estado = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  etapas: [] as Record<string, unknown>[],
  contato: null as Record<string, unknown> | null,
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
    from: (tabela: string) => {
      const encadeado = {
        select: () => encadeado,
        eq: () => encadeado,
        order: () => encadeado,
        limit: () => encadeado,
        maybeSingle: async () => ({ data: estado.contato }),
        insert: async (valores: Record<string, unknown>) => {
          estado.inserts.push({ tabela, ...valores })
          return { error: null }
        },
        update: (valores: Record<string, unknown>) => {
          estado.updates.push({ tabela, ...valores })
          return { eq: () => ({ eq: async () => ({ error: null }) }) }
        },
        then: (r: (v: { data: unknown; error: null }) => void) =>
          r({ data: estado.etapas, error: null }),
      }
      return encadeado
    },
  }),
}))

beforeEach(() => {
  estado.usuario = { id: 'user-1' }
  estado.etapas = [{ id: 'e1', nome: 'Novo', ordem: 0 }]
  estado.contato = { id: 'c1', etapa_id: 'e1', etapas: { nome: 'Novo' } }
  estado.inserts = []
  estado.updates = []
})

describe('criarEtapa', () => {
  it('cria no fim da fila', async () => {
    const r = await criarEtapa('Negociando')

    expect(r).toEqual({ ok: true })
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'etapas',
      owner_id: 'user-1',
      nome: 'Negociando',
      ordem: 1,
    })
  })

  it('recusa nome vazio', async () => {
    const r = await criarEtapa('   ')
    expect(r.erro).toBeTruthy()
    expect(estado.inserts).toHaveLength(0)
  })

  it('recusa nome acima do limite', async () => {
    const r = await criarEtapa('x'.repeat(25))
    expect(r.erro).toBeTruthy()
    expect(estado.inserts).toHaveLength(0)
  })

  // Server action é chamável por HTTP direto: o teto tem de valer no servidor.
  it('recusa acima do teto de etapas', async () => {
    estado.etapas = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`,
      nome: `Etapa ${i}`,
      ordem: i,
    }))
    const r = await criarEtapa('Mais uma')

    expect(r.erro).toMatch(/limite/i)
    expect(estado.inserts).toHaveLength(0)
  })

  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await criarEtapa('Negociando')
    expect(r.erro).toMatch(/Sessão expirada/)
  })
})

describe('moverContato', () => {
  it('atualiza a etapa e registra o histórico', async () => {
    const r = await moverContato('c1', 'e2')

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({
      tabela: 'contatos',
      etapa_id: 'e2',
    })
    // O histórico guarda o nome, não o id: renomear a etapa depois não pode
    // reescrever o passado.
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'contato_etapa_historico',
      contato_id: 'c1',
      de: 'Novo',
    })
  })

  it('aceita tirar o contato da esteira', async () => {
    const r = await moverContato('c1', null)

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({ etapa_id: null })
  })

  it('recusa contato que não é do usuário', async () => {
    estado.contato = null
    const r = await moverContato('alheio', 'e2')

    expect(r.erro).toBeTruthy()
    expect(estado.updates).toHaveLength(0)
  })

  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await moverContato('c1', 'e2')
    expect(r.erro).toMatch(/Sessão expirada/)
  })
})
