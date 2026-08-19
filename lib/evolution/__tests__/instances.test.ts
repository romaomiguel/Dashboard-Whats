import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  conectarInstancia,
  criarInstancia,
  desconectarInstancia,
  estadoInstancia,
  gerarNomeInstancia,
  removerInstancia,
} from '@/lib/evolution/instances'

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('gerarNomeInstancia', () => {
  it('usa o prefixo inst_ com 8 hex', () => {
    expect(gerarNomeInstancia()).toMatch(/^inst_[0-9a-f]{8}$/)
  })

  it('não repete em chamadas seguidas', () => {
    const nomes = new Set(Array.from({ length: 50 }, gerarNomeInstancia))
    expect(nomes.size).toBe(50)
  })
})

describe('operações de instância', () => {
  let fetchFalso: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('EVOLUTION_API_URL', 'https://evo.exemplo.com')
    vi.stubEnv('EVOLUTION_API_KEY', 'chave')
    fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('criarInstancia envia nome, integração Baileys e webhook', async () => {
    fetchFalso.mockResolvedValue(
      respostaJson({ instance: { instanceName: 'inst_a1b2c3d4' } }),
    )

    await criarInstancia('inst_a1b2c3d4', 'https://app.exemplo.com/api/webhooks/evolution/seg')

    const [url, opcoes] = fetchFalso.mock.calls[0]
    expect(url).toBe('https://evo.exemplo.com/instance/create')
    const corpo = JSON.parse(opcoes.body)
    expect(corpo.instanceName).toBe('inst_a1b2c3d4')
    expect(corpo.integration).toBe('WHATSAPP-BAILEYS')
    expect(corpo.qrcode).toBe(true)
    expect(corpo.webhook.url).toBe(
      'https://app.exemplo.com/api/webhooks/evolution/seg',
    )
    expect(corpo.webhook.events).toContain('CONNECTION_UPDATE')
    expect(corpo.webhook.events).toContain('QRCODE_UPDATED')
    expect(corpo.webhook.events).toContain('MESSAGES_UPSERT')
  })

  it('conectarInstancia busca o QR code', async () => {
    fetchFalso.mockResolvedValue(respostaJson({ base64: 'data:image/png;base64,AAA' }))

    const resposta = await conectarInstancia('inst_a1b2c3d4')

    expect(fetchFalso.mock.calls[0][0]).toBe(
      'https://evo.exemplo.com/instance/connect/inst_a1b2c3d4',
    )
    expect(resposta.base64).toBe('data:image/png;base64,AAA')
  })

  it('estadoInstancia extrai o estado de dentro de instance', async () => {
    fetchFalso.mockResolvedValue(
      respostaJson({ instance: { instanceName: 'inst_a1b2c3d4', state: 'open' } }),
    )
    await expect(estadoInstancia('inst_a1b2c3d4')).resolves.toBe('open')
  })

  it('estadoInstancia devolve close quando a instância sumiu', async () => {
    fetchFalso.mockResolvedValue(respostaJson({}, 404))
    await expect(estadoInstancia('inst_sumida')).resolves.toBe('close')
  })

  it('estadoInstancia propaga erro que não seja 404', async () => {
    fetchFalso.mockResolvedValue(respostaJson({}, 500))
    await expect(estadoInstancia('inst_a1b2c3d4')).rejects.toMatchObject({
      kind: 'servidor',
    })
  })

  it('desconectarInstancia usa DELETE em /instance/logout', async () => {
    fetchFalso.mockResolvedValue(respostaJson({ status: 'SUCCESS' }))
    await desconectarInstancia('inst_a1b2c3d4')

    const [url, opcoes] = fetchFalso.mock.calls[0]
    expect(url).toBe('https://evo.exemplo.com/instance/logout/inst_a1b2c3d4')
    expect(opcoes.method).toBe('DELETE')
  })

  it('removerInstancia é idempotente diante de 404', async () => {
    fetchFalso.mockResolvedValue(respostaJson({}, 404))
    await expect(removerInstancia('inst_ja_removida')).resolves.toBeUndefined()
  })
})
