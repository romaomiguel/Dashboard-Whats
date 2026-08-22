import { describe, expect, it } from 'vitest'
import { resolverArraste } from '@/app/(app)/esteira/arraste'

describe('resolverArraste', () => {
  it('lê a conversa arrastada e a coluna de destino', () => {
    expect(
      resolverArraste({ active: { id: 'f1' }, over: { id: 'e2' } }),
    ).toEqual({ funilId: 'f1', etapaId: 'e2' })
  })

  // Soltar fora de qualquer coluna é desistir do arraste, não um erro.
  it('devolve nulo quando solta fora de uma coluna', () => {
    expect(resolverArraste({ active: { id: 'f1' }, over: null })).toBeNull()
  })

  // Soltar na mesma coluna não é movimento: evita ida ao servidor à toa.
  it('devolve nulo quando a origem já é o destino', () => {
    expect(
      resolverArraste({ active: { id: 'f1', data: { etapaId: 'e2' } }, over: { id: 'e2' } }),
    ).toBeNull()
  })
})
