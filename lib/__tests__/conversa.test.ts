import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listarMensagensDaConversa,
  ordenarCronologico,
} from '@/lib/consultas/conversa'

const estado = vi.hoisted(() => ({
  // Linhas cruas de `mensagens`, como o select devolve: a consulta filtra por
  // número em memória, então o mock não pode entregar nada já filtrado.
  linhas: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    from: () => {
      const encadeado = {
        select: () => encadeado,
        order: () => encadeado,
        limit: () => encadeado,
        // Thenable: `await` na query resolve para a lista, como o
        // `select().order().limit()` do Supabase de verdade.
        then: (resolver: (r: { data: unknown; error: null }) => void) =>
          resolver({ data: estado.linhas, error: null }),
      }
      return encadeado
    },
  }),
}))

function linha(numero: string, id: string, hora: string) {
  return {
    id,
    numero,
    nome: 'Matheus',
    direcao: 'entrada',
    status: 'recebida',
    texto: `msg ${id}`,
    erro: null,
    criado_em: `2026-08-21T${hora}:00:00.000Z`,
  }
}

describe('ordenarCronologico', () => {
  // A thread lê de cima para baixo, ao contrário da lista de conversas, que
  // mostra a mais nova primeiro.
  it('põe a mais antiga primeiro', () => {
    const linhas = [
      { id: 'b', quando: '2026-08-21T10:00:00.000Z' },
      { id: 'a', quando: '2026-08-21T09:00:00.000Z' },
      { id: 'c', quando: '2026-08-21T11:00:00.000Z' },
    ]
    expect(ordenarCronologico(linhas).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('não explode com lista vazia', () => {
    expect(ordenarCronologico([])).toEqual([])
  })
})

describe('listarMensagensDaConversa', () => {
  beforeEach(() => {
    estado.linhas = [
      // O disparo gravou com o nono dígito...
      linha('5565984038479', 'a', '09'),
      // ...e o webhook gravou a resposta da mesma pessoa sem ele.
      linha('556584038479', 'b', '10'),
      // Outra pessoa: não pode entrar na thread de jeito nenhum.
      linha('5511999998888', 'c', '11'),
    ]
  })

  // As duas formas são a mesma pessoa. Comparando com `===`, metade da
  // conversa sumiria — foi exatamente o bug que originou `mesmoNumero`.
  it('junta as duas grafias do número pedindo com o nono dígito', async () => {
    const r = await listarMensagensDaConversa('5565984038479')
    expect(r.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('junta as duas grafias do número pedindo sem o nono dígito', async () => {
    const r = await listarMensagensDaConversa('556584038479')
    expect(r.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('devolve vazio para número sem conversa', async () => {
    expect(await listarMensagensDaConversa('5511900000000')).toEqual([])
  })
})
