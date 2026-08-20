import { describe, expect, it } from 'vitest'
import { estadoDaConversa } from '@/lib/conversas'

describe('estadoDaConversa', () => {
  it('saiu e ninguém respondeu ainda', () => {
    expect(
      estadoDaConversa({
        ultimaDirecao: 'saida',
        ultimoStatus: 'enviada',
        temEntrada: false,
      }),
    ).toBe('enviada')
  })

  it('a pessoa respondeu e está esperando', () => {
    expect(
      estadoDaConversa({
        ultimaDirecao: 'entrada',
        ultimoStatus: 'recebida',
        temEntrada: true,
      }),
    ).toBe('respondeu')
  })

  // A distinção que o usuário pediu: só o histórico separa os dois casos.
  it('eu respondi depois dela: respondida, não enviada', () => {
    expect(
      estadoDaConversa({
        ultimaDirecao: 'saida',
        ultimoStatus: 'enviada',
        temEntrada: true,
      }),
    ).toBe('respondida')
  })

  it('entrega lida sem resposta continua enviada', () => {
    expect(
      estadoDaConversa({
        ultimaDirecao: 'saida',
        ultimoStatus: 'lida',
        temEntrada: false,
      }),
    ).toBe('enviada')
  })

  it('falha tem precedência sobre o resto', () => {
    expect(
      estadoDaConversa({
        ultimaDirecao: 'saida',
        ultimoStatus: 'falhou',
        temEntrada: true,
      }),
    ).toBe('falhou')
  })
})
