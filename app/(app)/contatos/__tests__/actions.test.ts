import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  criarContato,
  excluirContatos,
  importarContatos,
} from '@/app/(app)/contatos/actions'

const banco = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  erro: null as { message: string; code?: string } | null,
  etiquetas: [] as { id: string; nome: string }[],
  inserts: [] as Record<string, unknown>[],
  upserts: [] as { registros: Record<string, unknown>[]; opcoes: unknown }[],
  deletes: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: banco.usuario } }) },
    from: (tabela: string) => ({
      select: async () => ({ data: banco.etiquetas, error: null }),
      insert: async (valores: Record<string, unknown>) => {
        banco.inserts.push(valores)
        return { error: banco.erro }
      },
      upsert: async (registros: Record<string, unknown>[], opcoes: unknown) => {
        banco.upserts.push({ registros, opcoes })
        return { error: banco.erro }
      },
      delete: () => {
        const filtros: Record<string, unknown> = { tabela }
        const encadeado = {
          in(coluna: string, valores: string[]) {
            filtros[coluna] = valores
            return encadeado
          },
          eq(coluna: string, valor: string) {
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
  banco.etiquetas = []
  banco.inserts = []
  banco.upserts = []
  banco.deletes = []
})

describe('criarContato', () => {
  it('grava nome, número e etiqueta amarrados ao dono', async () => {
    const estado = await criarContato(
      {},
      form({ nome: 'Joana', numero: '+55 11 90000-0000', etiqueta_id: 'etq-1' }),
    )

    expect(estado).toEqual({ ok: true, criados: 1 })
    expect(banco.inserts).toEqual([
      {
        owner_id: 'user-1',
        nome: 'Joana',
        numero: '+55 11 90000-0000',
        etiqueta_id: 'etq-1',
      },
    ])
  })

  it('sem etiqueta escolhida grava null, não string vazia', async () => {
    await criarContato({}, form({ nome: 'Joana', numero: '123', etiqueta_id: '' }))
    expect(banco.inserts[0].etiqueta_id).toBeNull()
  })

  it('recusa nome vazio sem tocar no banco', async () => {
    const estado = await criarContato({}, form({ nome: '  ', numero: '123' }))
    expect(estado.erro).toMatch(/nome/i)
    expect(banco.inserts).toHaveLength(0)
  })

  it('recusa número vazio sem tocar no banco', async () => {
    const estado = await criarContato({}, form({ nome: 'Joana', numero: '' }))
    expect(estado.erro).toMatch(/número/i)
    expect(banco.inserts).toHaveLength(0)
  })

  it('explica número repetido em vez de mostrar erro do Postgres', async () => {
    banco.erro = { message: 'duplicate key', code: '23505' }
    const estado = await criarContato({}, form({ nome: 'Joana', numero: '123' }))
    expect(estado.erro).toBe('Já existe um contato com esse número.')
  })

  it('avisa quando a migration ainda não rodou', async () => {
    banco.erro = { message: 'relation does not exist', code: '42P01' }
    const estado = await criarContato({}, form({ nome: 'Joana', numero: '123' }))
    expect(estado.erro).toMatch(/migration 0003/)
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await criarContato({}, form({ nome: 'Joana', numero: '123' }))
    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.inserts).toHaveLength(0)
  })
})

describe('importarContatos', () => {
  it('lê o CSV, pula o cabeçalho e amarra ao dono', async () => {
    const estado = await importarContatos(
      {},
      form({ conteudo: 'Nome,Numero\nJoana,123\nPedro,456' }),
    )

    expect(estado).toEqual({ ok: true, criados: 2 })
    expect(banco.upserts[0].registros).toEqual([
      { owner_id: 'user-1', nome: 'Joana', numero: '123', etiqueta_id: null },
      { owner_id: 'user-1', nome: 'Pedro', numero: '456', etiqueta_id: null },
    ])
  })

  it('resolve a etiqueta pelo nome, ignorando maiúsculas', async () => {
    banco.etiquetas = [{ id: 'etq-9', nome: 'VIP' }]
    await importarContatos({}, form({ conteudo: 'Joana,123,vip' }))
    expect(banco.upserts[0].registros[0].etiqueta_id).toBe('etq-9')
  })

  it('etiqueta desconhecida entra como sem etiqueta, não derruba a linha', async () => {
    await importarContatos({}, form({ conteudo: 'Joana,123,Inexistente' }))
    expect(banco.upserts[0].registros).toHaveLength(1)
    expect(banco.upserts[0].registros[0].etiqueta_id).toBeNull()
  })

  it('descarta linha sem nome ou sem número', async () => {
    await importarContatos({}, form({ conteudo: 'Joana,123\n,456\nPedro,' }))
    expect(banco.upserts[0].registros).toHaveLength(1)
  })

  it('descarta número repetido dentro do próprio arquivo', async () => {
    await importarContatos({}, form({ conteudo: 'Joana,123\nJoana Silva,123' }))
    expect(banco.upserts[0].registros).toHaveLength(1)
  })

  it('reimportar não falha na primeira duplicata', async () => {
    await importarContatos({}, form({ conteudo: 'Joana,123' }))
    expect(banco.upserts[0].opcoes).toEqual({
      onConflict: 'owner_id,numero',
      ignoreDuplicates: true,
    })
  })

  it('recusa arquivo vazio', async () => {
    const estado = await importarContatos({}, form({ conteudo: '   ' }))
    expect(estado.erro).toMatch(/arquivo CSV/)
    expect(banco.upserts).toHaveLength(0)
  })

  it('recusa arquivo que só tem cabeçalho', async () => {
    const estado = await importarContatos({}, form({ conteudo: 'Nome,Numero\n' }))
    expect(estado.erro).toMatch(/nenhuma linha de contato/)
    expect(banco.upserts).toHaveLength(0)
  })

  it('recusa quando toda linha está incompleta', async () => {
    const estado = await importarContatos({}, form({ conteudo: 'Joana,\n,456' }))
    expect(estado.erro).toMatch(/nome e número/)
    expect(banco.upserts).toHaveLength(0)
  })
})

describe('excluirContatos', () => {
  it('filtra por ids e por dono', async () => {
    const estado = await excluirContatos(['c1', 'c2'])

    expect(estado).toEqual({ ok: true })
    expect(banco.deletes.at(-1)).toMatchObject({
      id: ['c1', 'c2'],
      owner_id: 'user-1',
    })
  })

  it('lista vazia não vai ao banco', async () => {
    const estado = await excluirContatos([])
    expect(estado).toEqual({ ok: true })
    expect(banco.deletes).toHaveLength(0)
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await excluirContatos(['c1'])
    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.deletes).toHaveLength(0)
  })
})
