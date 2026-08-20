import { describe, expect, it } from 'vitest'
import { numeroParaWhatsApp, progresso } from '@/lib/disparos'

describe('numeroParaWhatsApp', () => {
  it('tira máscara e acrescenta o código do país', () => {
    expect(numeroParaWhatsApp('+55 11 91234-5678')).toBe('5511912345678')
  })

  it('completa o 55 em número escrito sem país', () => {
    expect(numeroParaWhatsApp('11912345678')).toBe('5511912345678')
    expect(numeroParaWhatsApp('(11) 3333-4444')).toBe('551133334444')
  })

  it('mantém o país quando ele já veio', () => {
    expect(numeroParaWhatsApp('5511912345678')).toBe('5511912345678')
  })

  it('aceita número de outro país', () => {
    expect(numeroParaWhatsApp('+1 415 555 2671')).toBe('14155552671')
  })

  it('recusa o que é curto demais para ser telefone', () => {
    expect(numeroParaWhatsApp('123')).toBeNull()
    expect(numeroParaWhatsApp('sem número')).toBeNull()
  })
})

describe('progresso', () => {
  it('multiplica antes de dividir, para 1840 de 3200 dar 58%', () => {
    expect(progresso(1840, 3200)).toBe(58)
  })

  it('total zero não divide por zero', () => {
    expect(progresso(0, 0)).toBe(0)
  })

  it('tudo enviado é 100%', () => {
    expect(progresso(50, 50)).toBe(100)
  })
})
