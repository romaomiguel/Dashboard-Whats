import { describe, expect, it } from 'vitest'
import { destinoSeguro } from '@/app/login/utils'

describe('destinoSeguro', () => {
  const baseHost = 'localhost'

  // Função auxiliar: verifica que resultado nunca sai do host
  const verificaOrigemLocal = (resultado: string) => {
    try {
      const url = new URL(resultado, 'http://localhost')
      return url.host === baseHost
    } catch {
      // Se falhar parseando, retorna false (string inválida)
      return false
    }
  }

  describe('Caminhos internos válidos - preserva origem local', () => {
    it('aceita caminho raiz /', () => {
      const resultado = destinoSeguro('/')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('aceita caminho interno simples /conexao', () => {
      const resultado = destinoSeguro('/conexao')
      expect(resultado).toBe('/conexao')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('aceita caminho com query string /contatos?busca=x', () => {
      const resultado = destinoSeguro('/contatos?busca=x')
      expect(resultado).toBe('/contatos?busca=x')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('aceita caminho com hash /mensagens#topo', () => {
      const resultado = destinoSeguro('/mensagens#topo')
      expect(resultado).toBe('/mensagens#topo')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('aceita caminho com query e hash /dashboard?tab=1#main', () => {
      const resultado = destinoSeguro('/dashboard?tab=1#main')
      expect(resultado).toBe('/dashboard?tab=1#main')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })
  })

  describe('Rejeição de open redirects - volta para /', () => {
    it('rejeita protocol-relative URL //evil.com', () => {
      const resultado = destinoSeguro('//evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita barra-backslash /\\evil.com', () => {
      const resultado = destinoSeguro('/\\evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita tab controlando //evil.com via /\\t/evil.com', () => {
      const resultado = destinoSeguro('/\t/evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita newline controlando //evil.com via /\\n/evil.com', () => {
      const resultado = destinoSeguro('/\n/evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita carriage return controlando //evil.com via /\\r/evil.com', () => {
      const resultado = destinoSeguro('/\r/evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita tab no início \\t//evil.com', () => {
      const resultado = destinoSeguro('\t//evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita URL com esquema http', () => {
      const resultado = destinoSeguro('http://evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita URL com esquema https', () => {
      const resultado = destinoSeguro('https://evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita URL com esquema https maiúsculo HTTPS://evil.com', () => {
      const resultado = destinoSeguro('HTTPS://evil.com')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita javascript: scheme', () => {
      const resultado = destinoSeguro('javascript:alert(1)')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita caminho relativo sem barra', () => {
      const resultado = destinoSeguro('conexao')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita string vazia', () => {
      const resultado = destinoSeguro('')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })

    it('rejeita lixo não parseável', () => {
      const resultado = destinoSeguro(':::não é válido:::')
      expect(resultado).toBe('/')
      expect(verificaOrigemLocal(resultado)).toBe(true)
    })
  })
})
