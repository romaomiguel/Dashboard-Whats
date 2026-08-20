import { describe, expect, it } from 'vitest'
import { chaveDoNumero, mesmoNumero } from '@/lib/numeros'

describe('chaveDoNumero', () => {
  // O caso real: disparo saiu para 5565984627628 e a resposta chegou de
  // 556584627628. Sem isto viravam duas conversas.
  it('celular brasileiro com e sem o nono dígito dá a mesma chave', () => {
    expect(chaveDoNumero('5565984627628')).toBe('556584627628')
    expect(chaveDoNumero('556584627628')).toBe('556584627628')
  })

  it('ignora máscara', () => {
    expect(chaveDoNumero('+55 65 98462-7628')).toBe('556584627628')
  })

  it('fixo brasileiro fica como está', () => {
    expect(chaveDoNumero('556533334444')).toBe('556533334444')
  })

  it('não tira o 9 de quem não é celular brasileiro de 13 dígitos', () => {
    // Número de outro país com 13 dígitos e 9 na quinta posição.
    expect(chaveDoNumero('4915901234567')).toBe('4915901234567')
  })

  it('não mexe em número curto demais para ter DDD e nono dígito', () => {
    expect(chaveDoNumero('84627628')).toBe('84627628')
  })
})

describe('mesmoNumero', () => {
  it('reconhece a mesma pessoa nas duas formas', () => {
    expect(mesmoNumero('+55 65 98462-7628', '556584627628')).toBe(true)
  })

  it('não confunde pessoas diferentes', () => {
    expect(mesmoNumero('5565984627628', '5565984038479')).toBe(false)
  })
})
