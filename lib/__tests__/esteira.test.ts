import { describe, expect, it } from 'vitest'
import {
  ETAPAS_PADRAO,
  LIMITE_ETAPAS,
  nomeDeEtapaValido,
  proximaOrdem,
} from '@/lib/esteira'

describe('etapas padrão', () => {
  // Esteira vazia não ensina nada; estas quatro cobrem o funil mínimo de
  // quem vende por WhatsApp.
  it('traz um funil inicial utilizável', () => {
    expect([...ETAPAS_PADRAO]).toEqual([
      'Novo',
      'Em conversa',
      'Negociando',
      'Fechado',
    ])
  })
})

describe('nomeDeEtapaValido', () => {
  it('aceita nome comum', () => {
    expect(nomeDeEtapaValido('Negociando')).toBe(true)
  })

  it('recusa vazio e só espaço', () => {
    expect(nomeDeEtapaValido('')).toBe(false)
    expect(nomeDeEtapaValido('   ')).toBe(false)
  })

  // Espelha o check da 0014; sem isto o insert falharia com 23514.
  it('recusa acima de 24 caracteres', () => {
    expect(nomeDeEtapaValido('x'.repeat(24))).toBe(true)
    expect(nomeDeEtapaValido('x'.repeat(25))).toBe(false)
  })
})

describe('proximaOrdem', () => {
  it('põe a nova no fim', () => {
    expect(proximaOrdem([0, 1, 2])).toBe(3)
  })

  it('começa do zero quando não há nenhuma', () => {
    expect(proximaOrdem([])).toBe(0)
  })

  // Remover uma etapa do meio deixa buracos; a próxima ainda tem de ser
  // maior que todas, senão duas etapas empatariam na ordenação.
  it('ignora buracos e usa o maior', () => {
    expect(proximaOrdem([0, 5, 2])).toBe(6)
  })
})

describe('LIMITE_ETAPAS', () => {
  it('existe para o quadro não virar rolagem horizontal infinita', () => {
    expect(LIMITE_ETAPAS).toBe(12)
  })
})
