import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarEsteira } from '@/lib/consultas/esteira'

const estado = vi.hoisted(() => ({
  etapas: [] as Record<string, unknown>[],
  funil: [] as Record<string, unknown>[],
  contatos: [] as Record<string, unknown>[],
  mensagens: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    from: (tabela: string) => {
      const dados =
        tabela === 'etapas'
          ? estado.etapas
          : tabela === 'funil'
            ? estado.funil
            : tabela === 'contatos'
              ? estado.contatos
              : estado.mensagens
      const encadeado = {
        select: () => encadeado,
        order: () => encadeado,
        limit: () => encadeado,
        then: (r: (v: { data: unknown; error: null }) => void) => r({ data: dados, error: null }),
      }
      return encadeado
    },
  }),
}))

beforeEach(() => {
  estado.etapas = [{ id: 'e1', nome: 'Novo', ordem: 0, papel: 'entrada' }]
  estado.funil = [
    { id: 'f1', chave_numero: '556584038479', numero: '556584038479', etapa_id: 'e1' },
  ]
  estado.contatos = []
  estado.mensagens = []
})

describe('listarEsteira', () => {
  it('devolve o papel junto da etapa', async () => {
    const { etapas } = await listarEsteira()
    expect(etapas[0]).toEqual({ id: 'e1', nome: 'Novo', ordem: 0, papel: 'entrada' })
  })

  // O contato foi cadastrado com o nono dígito e a conversa veio sem: é a
  // mesma pessoa, e o card tem de mostrar o nome, não o número.
  it('acha o nome do contato pela chave canônica', async () => {
    estado.contatos = [{ nome: 'Matheus', numero: '5565984038479' }]

    const { linhas } = await listarEsteira()
    expect(linhas[0]).toMatchObject({ id: 'f1', nome: 'Matheus', numero: '556584038479' })
  })

  // Quem te escreveu sem estar no cadastro ainda tem nome: o pushName. A
  // mensagem chega com o nono dígito — a forma oposta à do funil — para que
  // o teste quebre se o pushName parar de passar por chaveDoNumero.
  it('cai no pushName quando não há contato', async () => {
    estado.mensagens = [{ numero: '5565984038479', nome: 'Ana' }]

    const { linhas } = await listarEsteira()
    expect(linhas[0].nome).toBe('Ana')
  })

  it('cai no próprio número quando não há nome nenhum', async () => {
    const { linhas } = await listarEsteira()
    expect(linhas[0].nome).toBe('556584038479')
  })

  it('o contato cadastrado ganha do pushName', async () => {
    estado.contatos = [{ nome: 'Matheus', numero: '556584038479' }]
    estado.mensagens = [{ numero: '5565984038479', nome: 'Ana' }]

    const { linhas } = await listarEsteira()
    expect(linhas[0].nome).toBe('Matheus')
  })

  // A consulta devolve as mensagens da mais nova para a mais antiga; o mapa
  // de pushName tem de manter só a primeira que aparecer. Duas linhas da
  // mesma pessoa, nesta ordem, provam a guarda — se ela virar um set()
  // incondicional, a segunda (mais antiga) sobrescreve a primeira.
  it('mantém o pushName mais recente quando há mais de uma mensagem', async () => {
    estado.mensagens = [
      { numero: '5565984038479', nome: 'Ana Nova' },
      { numero: '5565984038479', nome: 'Ana Antiga' },
    ]

    const { linhas } = await listarEsteira()
    expect(linhas[0].nome).toBe('Ana Nova')
  })
})
