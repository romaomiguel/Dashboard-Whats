import { describe, expect, it } from 'vitest'
import { formatarData, formatarDataHora, formatarHora } from '@/lib/datas'

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
