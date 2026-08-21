import { describe, expect, it } from 'vitest'
import {
  formatarData,
  formatarDataHora,
  formatarHora,
  tempoRelativo,
} from '@/lib/datas'

// O fuso fixo é o ponto: sem ele, servidor (UTC) e navegador escrevem textos
// diferentes para o mesmo instante e o React acusa erro de hidratação (#418).
describe('formatação com fuso fixo', () => {
  const instante = '2026-08-20T05:01:53.000Z' // 02:01 em São Paulo

  it('data e hora saem no fuso de São Paulo, não em UTC', () => {
    expect(formatarDataHora(instante)).toBe('20/08, 02:01')
  })

  it('só a data', () => {
    expect(formatarData(instante)).toBe('20/08/2026')
  })

  it('só a hora', () => {
    expect(formatarHora(instante)).toBe('02:01')
  })

  it('o resultado não depende do fuso de quem chama', () => {
    const tz = process.env.TZ
    process.env.TZ = 'Asia/Tokyo'
    expect(formatarDataHora(instante)).toBe('20/08, 02:01')
    process.env.TZ = tz
  })

  it('data inválida devolve o que recebeu, em vez de "Invalid Date"', () => {
    expect(formatarData('não é data')).toBe('não é data')
  })
})

describe('tempo relativo', () => {
  const agora = new Date('2026-08-20T12:00:00.000Z')

  function atras(ms: number): string {
    return new Date(agora.getTime() - ms).toISOString()
  }

  const SEGUNDO = 1000
  const MINUTO = 60 * SEGUNDO
  const HORA = 60 * MINUTO
  const DIA = 24 * HORA

  it('abaixo de um minuto não conta segundos', () => {
    expect(tempoRelativo(atras(30 * SEGUNDO), agora)).toBe('agora')
  })

  it('conta minutos até virar hora', () => {
    expect(tempoRelativo(atras(5 * MINUTO), agora)).toBe('há 5 min')
    expect(tempoRelativo(atras(59 * MINUTO), agora)).toBe('há 59 min')
  })

  it('conta horas até virar dia', () => {
    expect(tempoRelativo(atras(HORA), agora)).toBe('há 1 h')
    expect(tempoRelativo(atras(23 * HORA), agora)).toBe('há 23 h')
  })

  it('conta dias até uma semana', () => {
    expect(tempoRelativo(atras(DIA), agora)).toBe('há 1 d')
    expect(tempoRelativo(atras(6 * DIA), agora)).toBe('há 6 d')
  })

  // "há 34 d" faz o leitor calcular a data que a data já daria pronta.
  it('a partir de uma semana devolve a data absoluta', () => {
    expect(tempoRelativo(atras(7 * DIA), agora)).toBe('13/08/2026')
    expect(tempoRelativo(atras(60 * DIA), agora)).toBe('21/06/2026')
  })

  // Relógio do navegador atrasado em relação ao do banco: "há -1 min"
  // pareceria defeito, e o instante ainda é essencialmente agora.
  it('instante no futuro vira agora, não um número negativo', () => {
    expect(tempoRelativo(atras(-5 * MINUTO), agora)).toBe('agora')
  })

  it('data inválida devolve o que recebeu', () => {
    expect(tempoRelativo('não é data', agora)).toBe('não é data')
  })
})
