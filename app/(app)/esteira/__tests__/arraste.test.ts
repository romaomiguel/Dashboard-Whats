import { describe, expect, it } from 'vitest'
import { resolverArraste, resolverDestino } from '@/app/(app)/esteira/arraste'

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

// Fixtures no formato que o dnd-kit entrega de verdade: `data` é um ref, e
// `over.id` pode ser uma coluna ou outro card. Lendo `data.etapaId` direto,
// como a versão original fazia, todos estes casos passariam errado.
const etapas = [{ id: 'e1' }, { id: 'e2' }]
const linhas = [
  { id: 'f1', etapaId: 'e1' },
  { id: 'f2', etapaId: 'e2' },
  { id: 'f3', etapaId: null },
]

describe('resolverDestino', () => {
  it('move para a coluna quando solta na própria coluna de destino', () => {
    expect(
      resolverDestino(
        { active: { id: 'f1', data: { current: { etapaId: 'e1' } } }, over: { id: 'e2' } },
        etapas,
        linhas,
      ),
    ).toEqual({ funilId: 'f1', etapaId: 'e2' })
  })

  // Os itens do SortableContext também são alvos de soltura: com
  // closestCorners o `over` mais próximo costuma ser um card, não a coluna.
  // Sem traduzir, o destino seria um id que não existe em `etapas`.
  it('traduz o card irmão para a etapa dele', () => {
    expect(
      resolverDestino(
        { active: { id: 'f1', data: { current: { etapaId: 'e1' } } }, over: { id: 'f2' } },
        etapas,
        linhas,
      ),
    ).toEqual({ funilId: 'f1', etapaId: 'e2' })
  })

  it('devolve nulo quando solta sobre um card da própria coluna', () => {
    expect(
      resolverDestino(
        { active: { id: 'f2', data: { current: { etapaId: 'e2' } } }, over: { id: 'f2' } },
        etapas,
        linhas,
      ),
    ).toBeNull()
  })

  // Id que não é coluna nem card conhecido: não há destino a inventar, e
  // mandar o id cru faria o servidor responder "Etapa não encontrada".
  it('devolve nulo quando o alvo não é coluna nem card conhecido', () => {
    expect(
      resolverDestino(
        { active: { id: 'f1', data: { current: { etapaId: 'e1' } } }, over: { id: 'sei-la' } },
        etapas,
        linhas,
      ),
    ).toBeNull()
  })

  // Card órfão não é renderizado, mas se virar alvo o etapaId dele é nulo:
  // não dá para traduzir, então não há movimento.
  it('devolve nulo quando o card alvo está sem etapa', () => {
    expect(
      resolverDestino(
        { active: { id: 'f1', data: { current: { etapaId: 'e1' } } }, over: { id: 'f3' } },
        etapas,
        linhas,
      ),
    ).toBeNull()
  })

  // A guarda de mesma coluna não pode depender de um dado opcional: sem o
  // payload do ref, a origem sai das próprias linhas.
  it('descobre a origem pelas linhas quando o payload do ref não veio', () => {
    expect(
      resolverDestino({ active: { id: 'f1' }, over: { id: 'e1' } }, etapas, linhas),
    ).toBeNull()

    expect(
      resolverDestino({ active: { id: 'f1', data: {} }, over: { id: 'e1' } }, etapas, linhas),
    ).toBeNull()
  })

  it('devolve nulo quando solta fora de qualquer alvo', () => {
    expect(
      resolverDestino(
        { active: { id: 'f1', data: { current: { etapaId: 'e1' } } }, over: null },
        etapas,
        linhas,
      ),
    ).toBeNull()
  })
})
