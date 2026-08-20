import { describe, expect, it } from 'vitest'
import { descobrirUrlDoApp } from '@/lib/app-url'

describe('descobrirUrlDoApp', () => {
  it('APP_URL tem a palavra final', () => {
    expect(
      descobrirUrlDoApp({
        APP_URL: 'https://meu.app',
        VERCEL_PROJECT_PRODUCTION_URL: 'producao.vercel.app',
      }),
    ).toBe('https://meu.app')
  })

  // Na Vercel esta vem sozinha: o webhook funciona sem ninguém configurar.
  it('usa o domínio de produção da Vercel e acrescenta o protocolo', () => {
    expect(
      descobrirUrlDoApp({ VERCEL_PROJECT_PRODUCTION_URL: 'zapcrm.vercel.app' }),
    ).toBe('https://zapcrm.vercel.app')
  })

  it('VERCEL_URL só entra depois, por apontar para um deploy específico', () => {
    expect(
      descobrirUrlDoApp({
        VERCEL_PROJECT_PRODUCTION_URL: 'estavel.vercel.app',
        VERCEL_URL: 'deploy-abc123.vercel.app',
      }),
    ).toBe('https://estavel.vercel.app')
  })

  it('cai na NEXT_PUBLIC_APP_URL por último, que serve ao desenvolvimento', () => {
    expect(
      descobrirUrlDoApp({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }),
    ).toBe('http://localhost:3000')
  })

  it('tira a barra do fim, para a URL não sair com duas', () => {
    expect(descobrirUrlDoApp({ APP_URL: 'https://meu.app///' })).toBe(
      'https://meu.app',
    )
  })

  it('ignora valor em branco em vez de aceitá-lo como endereço', () => {
    expect(
      descobrirUrlDoApp({ APP_URL: '   ', VERCEL_URL: 'certo.vercel.app' }),
    ).toBe('https://certo.vercel.app')
  })

  // Este é o caso que gravou o webhook quebrado: nada definido, e a montagem
  // seguia adiante produzindo "/api/webhooks/...".
  it('sem nada definido, devolve null para quem chama poder falhar alto', () => {
    expect(descobrirUrlDoApp({})).toBeNull()
  })
})
