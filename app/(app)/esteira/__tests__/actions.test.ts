import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarEtapa, definirPapel, moverNoFunil, removerEtapa } from '@/app/(app)/esteira/actions'

const estado = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  // Linhas de `etapas` para a contagem do teto em criarEtapa (select bruto).
  etapas: [] as Record<string, unknown>[],
  // `funil.maybeSingle()`: a linha do funil buscada por moverNoFunil.
  linhaFunil: null as Record<string, unknown> | null,
  // `etapas.maybeSingle()`: a etapa de destino buscada por moverNoFunil.
  // Estado separado da linha do funil acima — antes as duas tabelas caíam no
  // mesmo valor e a checagem de dono da etapa destino ficava impossível de
  // testar.
  etapaDestino: null as Record<string, unknown> | null,
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  deletes: [] as Record<string, unknown>[],
  erroDelete: null as { code?: string; message: string } | null,
  // Erro devolvido pelo próximo `update`: usado para simular o `23505` do
  // índice único parcial de `etapas.papel`.
  erroUpdate: null as { code?: string; message: string } | null,
  // Erro devolvido pelo próximo `insert`, quando encadeado com
  // `.select().maybeSingle()` (o caso de criarEtapa lendo o id de volta).
  erroInsert: null as { code?: string; message: string } | null,
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
        // Mock ciente da tabela: `funil` e `etapas` respondem buscas por id
        // de forma independente, senão nada distingue a linha do funil do
        // usuário da etapa de destino.
        maybeSingle: async () =>
          tabela === 'etapas' ? { data: estado.etapaDestino } : { data: estado.linhaFunil },
        insert: (valores: Record<string, unknown>) => {
          estado.inserts.push({ tabela, ...valores })
          const resultado = { data: null, error: estado.erroInsert }
          const cadeia = {
            // criarEtapa encadeia `.select('id').maybeSingle()` para ler de
            // volta o id da etapa recém-criada.
            select: () => ({
              maybeSingle: async () => ({ data: { id: 'e-nova' }, error: estado.erroInsert }),
            }),
            then: (r: (v: typeof resultado) => void) => r(resultado),
          }
          return cadeia
        },
        // Mesmo encadeamento do delete abaixo: registra cada `.eq()` no
        // mesmo objeto. O `{ eq: () => ({ eq: async () => ... }) }` de antes
        // não gravava coluna nenhuma e ainda terminava a cadeia num objeto
        // não-thenable — tirar `.eq('owner_id')` do UPDATE devolvia `error`
        // indefinido e o teste passava, liberando um UPDATE sem dono.
        update: (valores: Record<string, unknown>) => {
          const registro: Record<string, unknown> = { tabela, ...valores }
          const cadeia = {
            eq: (coluna: string, valor: unknown) => {
              registro[coluna] = valor
              return cadeia
            },
            then: (r: (v: { data: null; error: unknown }) => void) => {
              estado.updates.push(registro)
              return r({ data: null, error: estado.erroUpdate })
            },
          }
          return cadeia
        },
        // Encadeamento próprio para o delete: registra cada `.eq()` no
        // mesmo objeto, para provar que a remoção filtra por id **e** por
        // owner_id, não só pelo id.
        delete: () => {
          const registro: Record<string, unknown> = { tabela }
          const cadeia = {
            eq: (coluna: string, valor: unknown) => {
              registro[coluna] = valor
              return cadeia
            },
            then: (r: (v: { data: null; error: unknown }) => void) => {
              estado.deletes.push(registro)
              return r({ data: null, error: estado.erroDelete })
            },
          }
          return cadeia
        },
        then: (r: (v: { data: unknown; error: null }) => void) =>
          r({ data: tabela === 'etapas' ? estado.etapas : [], error: null }),
      }
      return encadeado
    },
  }),
}))

beforeEach(() => {
  estado.usuario = { id: 'user-1' }
  estado.etapas = [{ id: 'e1', nome: 'Novo', ordem: 0 }]
  estado.linhaFunil = { id: 'f1', etapa_id: 'e1', etapas: { nome: 'Novo' } }
  estado.etapaDestino = { id: 'e2', nome: 'Negociando' }
  estado.inserts = []
  estado.updates = []
  estado.deletes = []
  estado.erroDelete = null
  estado.erroUpdate = null
  estado.erroInsert = null
})

describe('criarEtapa', () => {
  it('cria no fim da fila', async () => {
    const r = await criarEtapa('Negociando')

    expect(r).toEqual({ ok: true, id: 'e-nova' })
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'etapas',
      owner_id: 'user-1',
      nome: 'Negociando',
      ordem: 1,
    })
  })

  it('devolve o id da etapa criada', async () => {
    const r = await criarEtapa('Negociando')
    expect(r.id).toBe('e-nova')
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

describe('moverNoFunil', () => {
  it('atualiza a etapa e registra o histórico como manual', async () => {
    const r = await moverNoFunil('f1', 'e2')

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({ tabela: 'funil', etapa_id: 'e2' })
    // O histórico guarda o nome: renomear a etapa depois não reescreve o
    // passado. `automatico: false` separa isto da promoção do webhook.
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'funil_historico',
      funil_id: 'f1',
      de: 'Novo',
      automatico: false,
    })
  })

  // Só o id não bastaria: sem o owner_id no filtro, um id de funil
  // adivinhado de outro usuário seria movido junto — a RLS é o backstop, não
  // o único controle.
  it('atualiza filtrando por id e por dono, não só pelo id', async () => {
    const r = await moverNoFunil('f1', 'e2')

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({
      tabela: 'funil',
      id: 'f1',
      owner_id: 'user-1',
    })
  })

  it('recusa linha que não é do usuário', async () => {
    estado.linhaFunil = null
    const r = await moverNoFunil('alheia', 'e2')

    expect(r.erro).toBeTruthy()
    expect(estado.updates).toHaveLength(0)
  })

  it('recusa etapa de destino que não é do usuário', async () => {
    estado.etapaDestino = null
    const r = await moverNoFunil('f1', 'e-alheia')

    expect(r.erro).toMatch(/Etapa não encontrada/)
    expect(estado.updates).toHaveLength(0)
    expect(estado.inserts).toHaveLength(0)
  })

  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await moverNoFunil('f1', 'e2')
    expect(r.erro).toMatch(/Sessão expirada/)
  })
})

describe('definirPapel', () => {
  it('marca o papel na etapa do usuário', async () => {
    const r = await definirPapel('e1', 'entrada')

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({
      tabela: 'etapas',
      papel: 'entrada',
      id: 'e1',
      owner_id: 'user-1',
    })
  })

  it('aceita limpar o papel', async () => {
    const r = await definirPapel('e1', null)
    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({ papel: null })
  })

  it('recusa papel inventado', async () => {
    const r = await definirPapel('e1', 'chefe' as never)
    expect(r.erro).toBeTruthy()
    expect(estado.updates).toHaveLength(0)
  })

  // Índice único parcial: o papel já está em outra etapa.
  it('explica quando o papel já é de outra etapa', async () => {
    estado.erroUpdate = { code: '23505', message: 'duplicado' }
    const r = await definirPapel('e1', 'entrada')
    expect(r.erro).toMatch(/outra etapa/i)
  })

  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await definirPapel('e1', 'entrada')
    expect(r.erro).toMatch(/Sessão expirada/)
  })
})

describe('removerEtapa', () => {
  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await removerEtapa('e1')

    expect(r.erro).toMatch(/Sessão expirada/)
    expect(estado.deletes).toHaveLength(0)
  })

  it('remove filtrando por id e por dono, não só pelo id', async () => {
    const r = await removerEtapa('e1')

    expect(r).toEqual({ ok: true })
    // Só o id não bastaria: sem o owner_id no filtro, um id de etapa
    // adivinhado de outro usuário seria apagado também — a RLS é o
    // backstop, não o único controle.
    expect(estado.deletes.at(-1)).toMatchObject({
      tabela: 'etapas',
      id: 'e1',
      owner_id: 'user-1',
    })
  })

  it('devolve mensagem amigável quando o delete falha', async () => {
    estado.erroDelete = { code: '23503', message: 'em uso' }
    const r = await removerEtapa('e1')

    expect(r.erro).toBe('Não foi possível remover a etapa.')
  })
})
