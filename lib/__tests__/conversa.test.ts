import { describe, expect, it } from 'vitest'
import { ordenarCronologico } from '@/lib/consultas/conversa'

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
