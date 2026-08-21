import { describe, expect, it } from 'vitest'
import { descobrirUrlDoApp, ehEnderecoAlcancavel } from '@/lib/app-url'

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

describe('ehEnderecoAlcancavel', () => {
  // O webhook é chamado DE FORA: quem precisa alcançar o endereço é a
  // Evolution, hospedada em outra máquina, não o navegador do usuário.
  it('aceita domínio público', () => {
    expect(ehEnderecoAlcancavel('https://dashboard-whats-mu.vercel.app')).toBe(true)
    expect(ehEnderecoAlcancavel('https://meu.app')).toBe(true)
  })

  // Para a Evolution, localhost é ela mesma — o webhook cai no próprio
  // contêiner dela e nunca chega ao app.
  it('recusa localhost em todas as formas', () => {
    expect(ehEnderecoAlcancavel('http://localhost:3000')).toBe(false)
    expect(ehEnderecoAlcancavel('http://127.0.0.1:3000')).toBe(false)
    expect(ehEnderecoAlcancavel('http://[::1]:3000')).toBe(false)
    expect(ehEnderecoAlcancavel('http://0.0.0.0:3000')).toBe(false)
  })

  it('recusa faixa privada, que não se alcança pela internet', () => {
    expect(ehEnderecoAlcancavel('http://192.168.0.10:3000')).toBe(false)
    expect(ehEnderecoAlcancavel('http://10.1.2.3:3000')).toBe(false)
    expect(ehEnderecoAlcancavel('http://172.16.5.4:3000')).toBe(false)
    expect(ehEnderecoAlcancavel('http://169.254.1.1:3000')).toBe(false)
  })

  // 172.32 está FORA da faixa privada (que vai até 172.31): recusar por
  // prefixo "172." pegaria endereço público legítimo.
  it('não confunde 172 público com a faixa privada', () => {
    expect(ehEnderecoAlcancavel('http://172.32.0.1:3000')).toBe(true)
    expect(ehEnderecoAlcancavel('http://172.15.0.1:3000')).toBe(true)
  })

  // IP público direto serve: é o caso de quem expõe a máquina de dev.
  it('aceita IP público', () => {
    expect(ehEnderecoAlcancavel('http://54.232.189.113:3000')).toBe(true)
  })

  // .local é resolvido por mDNS, só dentro da rede.
  it('recusa domínio .local', () => {
    expect(ehEnderecoAlcancavel('http://meu-pc.local:3000')).toBe(false)
  })

  it('recusa o que nem é URL', () => {
    expect(ehEnderecoAlcancavel('não é url')).toBe(false)
    expect(ehEnderecoAlcancavel('')).toBe(false)
  })
})
