import { describe, expect, it } from 'vitest'
import { ehRotaPublica } from '@/lib/supabase/middleware'

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
