import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/webhooks/evolution/segredo-certo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

const evento = {
  event: 'connection.update',
  instance: 'inst_a1b2c3d4',
  data: { state: 'open' },
}

describe('POST /api/webhooks/evolution/[segredo]', () => {
  beforeEach(() => {
    vi.stubEnv('WEBHOOK_SECRET', 'segredo-certo')
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('aceita evento com o segredo correto', async () => {
    const resposta = await POST(requisicao(evento), {
      params: Promise.resolve({ segredo: 'segredo-certo' }),
    })
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({ ok: true })
  })

  it('devolve 404 para segredo errado, sem revelar que a rota existe', async () => {
    const resposta = await POST(requisicao(evento), {
      params: Promise.resolve({ segredo: 'segredo-errado' }),
    })
    expect(resposta.status).toBe(404)
  })

  it('devolve 404 quando WEBHOOK_SECRET não está configurado', async () => {
    vi.stubEnv('WEBHOOK_SECRET', '')
    const resposta = await POST(requisicao(evento), {
      params: Promise.resolve({ segredo: '' }),
    })
    expect(resposta.status).toBe(404)
  })

  it('devolve 400 para corpo que não é JSON', async () => {
    const req = new Request('http://localhost/api/webhooks/evolution/segredo-certo', {
      method: 'POST',
      body: 'isto não é json',
    })
    const resposta = await POST(req, {
      params: Promise.resolve({ segredo: 'segredo-certo' }),
    })
    expect(resposta.status).toBe(400)
  })

  it('devolve 400 quando falta o campo instance', async () => {
    const resposta = await POST(requisicao({ event: 'connection.update' }), {
      params: Promise.resolve({ segredo: 'segredo-certo' }),
    })
    expect(resposta.status).toBe(400)
  })
})
