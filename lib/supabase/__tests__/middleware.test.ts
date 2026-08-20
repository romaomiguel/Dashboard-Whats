import { describe, expect, it } from 'vitest'
import { destinoDeRetorno, ehRotaPublica } from '@/lib/supabase/middleware'

describe('ehRotaPublica', () => {
  it('libera a tela de login', () => {
    expect(ehRotaPublica('/login')).toBe(true)
  })

  it('libera o receptor de webhook, inclusive com segredo no caminho', () => {
    expect(ehRotaPublica('/api/webhooks/evolution/abc123')).toBe(true)
  })

  it('protege a home', () => {
    expect(ehRotaPublica('/')).toBe(false)
  })

  it('protege as telas internas', () => {
    expect(ehRotaPublica('/conexao')).toBe(false)
    expect(ehRotaPublica('/disparos')).toBe(false)
  })

  it('não libera caminho que apenas começa parecido com /login', () => {
    expect(ehRotaPublica('/loginfalso')).toBe(false)
  })
})

describe('destinoDeRetorno', () => {
  it('preserva a query, para a busca não se perder no login', () => {
    expect(destinoDeRetorno(new URL('http://localhost:3000/contatos?busca=Sofia'))).toBe(
      '/contatos?busca=Sofia',
    )
  })

  it('devolve só o caminho quando não há query', () => {
    expect(destinoDeRetorno(new URL('http://localhost:3000/disparos'))).toBe('/disparos')
  })

  it('não vaza a origem', () => {
    const destino = destinoDeRetorno(new URL('http://localhost:3000/midias?a=1'))
    expect(destino.startsWith('/')).toBe(true)
    expect(destino).not.toContain('localhost')
  })
})
