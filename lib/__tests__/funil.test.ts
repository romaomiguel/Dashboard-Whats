import { describe, expect, it } from 'vitest'
import { decidirMovimento } from '@/lib/funil'

const papeis = { etapaEntradaId: 'e-novo', etapaRespondeuId: 'e-conversa' }

describe('decidirMovimento', () => {
  // Um disparo para 300 pessoas tem de nascer como 300 cards em "Novo".
  it('aloca conversa nova na etapa de entrada, venha de onde vier', () => {
    expect(
      decidirMovimento({ existe: false, etapaAtualId: null, direcao: 'saida', ...papeis }),
    ).toEqual({ tipo: 'alocar', etapaId: 'e-novo' })

    expect(
      decidirMovimento({ existe: false, etapaAtualId: null, direcao: 'entrada', ...papeis }),
    ).toEqual({ tipo: 'alocar', etapaId: 'e-novo' })
  })

  it('promove quem respondeu, saindo da entrada', () => {
    expect(
      decidirMovimento({ existe: true, etapaAtualId: 'e-novo', direcao: 'entrada', ...papeis }),
    ).toEqual({ tipo: 'promover', etapaId: 'e-conversa' })
  })

  // A regra que protege o trabalho manual: sem ela, qualquer mensagem
  // arrastaria de volta para "Em conversa" quem já foi para "Negociando".
  it('não mexe em quem já passou da entrada', () => {
    expect(
      decidirMovimento({
        existe: true,
        etapaAtualId: 'e-negociando',
        direcao: 'entrada',
        ...papeis,
      }),
    ).toEqual({ tipo: 'nada' })
  })

  it('mensagem enviada não promove ninguém', () => {
    expect(
      decidirMovimento({ existe: true, etapaAtualId: 'e-novo', direcao: 'saida', ...papeis }),
    ).toEqual({ tipo: 'nada' })
  })

  // Etapa apagada deixa `etapa_id` nulo. Sem a coluna "Sem etapa", esse
  // card não teria onde aparecer e sumiria do quadro.
  it('devolve para a entrada a linha que ficou órfã', () => {
    expect(
      decidirMovimento({ existe: true, etapaAtualId: null, direcao: 'saida', ...papeis }),
    ).toEqual({ tipo: 'alocar', etapaId: 'e-novo' })
  })

  // Nunca inventar etapa: sem papel marcado, a automação fica quieta.
  it('não faz nada sem etapa de entrada marcada', () => {
    expect(
      decidirMovimento({
        existe: false,
        etapaAtualId: null,
        direcao: 'entrada',
        etapaEntradaId: null,
        etapaRespondeuId: 'e-conversa',
      }),
    ).toEqual({ tipo: 'nada' })
  })

  it('não promove sem etapa de respondeu marcada', () => {
    expect(
      decidirMovimento({
        existe: true,
        etapaAtualId: 'e-novo',
        direcao: 'entrada',
        etapaEntradaId: 'e-novo',
        etapaRespondeuId: null,
      }),
    ).toEqual({ tipo: 'nada' })
  })
})
