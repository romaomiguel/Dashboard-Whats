import { describe, expect, it } from 'vitest'
import { destinoSeguro } from '@/app/login/utils'

describe('destinoSeguro', () => {
  it('aceita caminho raiz', () => {
    expect(destinoSeguro('/')).toBe('/')
  })

  it('aceita caminho interno válido', () => {
    expect(destinoSeguro('/conexao')).toBe('/conexao')
  })

  it('rejeita redirect com //', () => {
    expect(destinoSeguro('//evil.com')).toBe('/')
  })

  it('rejeita redirect com /\\', () => {
    expect(destinoSeguro('/\\evil.com')).toBe('/')
  })

  it('rejeita URL com protocolo http', () => {
    expect(destinoSeguro('http://evil.com')).toBe('/')
  })

  it('rejeita URL com protocolo https', () => {
    expect(destinoSeguro('https://evil.com')).toBe('/')
  })

  it('rejeita caminho sem barra inicial', () => {
    expect(destinoSeguro('conexao')).toBe('/')
  })
})
