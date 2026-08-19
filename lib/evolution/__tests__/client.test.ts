import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chamar } from '@/lib/evolution/client'
import { EvolutionError } from '@/lib/evolution/errors'

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('chamar', () => {
  beforeEach(() => {
    vi.stubEnv('EVOLUTION_API_URL', 'https://evo.exemplo.com')
    vi.stubEnv('EVOLUTION_API_KEY', 'chave-secreta')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('envia o header apikey e monta a URL completa', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({ ok: true }))
    vi.stubGlobal('fetch', fetchFalso)

    await chamar('/instance/fetchInstances')

    const [url, opcoes] = fetchFalso.mock.calls[0]
    expect(url).toBe('https://evo.exemplo.com/instance/fetchInstances')
    expect(opcoes.headers.apikey).toBe('chave-secreta')
    expect(opcoes.method).toBe('GET')
  })

  it('remove barra final da URL base para não gerar caminho duplo', async () => {
    vi.stubEnv('EVOLUTION_API_URL', 'https://evo.exemplo.com/')
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({}))
    vi.stubGlobal('fetch', fetchFalso)

    await chamar('/instance/fetchInstances')

    expect(fetchFalso.mock.calls[0][0]).toBe(
      'https://evo.exemplo.com/instance/fetchInstances',
    )
  })

  it('serializa o corpo e marca content-type em POST', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({}))
    vi.stubGlobal('fetch', fetchFalso)

    await chamar('/instance/create', {
      metodo: 'POST',
      corpo: { instanceName: 'inst_a1b2' },
    })

    const opcoes = fetchFalso.mock.calls[0][1]
    expect(opcoes.method).toBe('POST')
    expect(opcoes.headers['content-type']).toBe('application/json')
    expect(JSON.parse(opcoes.body)).toEqual({ instanceName: 'inst_a1b2' })
  })

  it('devolve o JSON da resposta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({ state: 'open' })))
    await expect(chamar('/qualquer')).resolves.toEqual({ state: 'open' })
  })

  it('classifica 401 como erro de autenticação', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, 401)))
    await expect(chamar('/qualquer')).rejects.toMatchObject({
      name: 'EvolutionError',
      kind: 'autenticacao',
      status: 401,
    })
  })

  it('classifica 404 como instância inexistente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, 404)))
    await expect(chamar('/qualquer')).rejects.toMatchObject({
      kind: 'instancia_inexistente',
    })
  })

  it('classifica 500 como erro de servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, 500)))
    await expect(chamar('/qualquer')).rejects.toMatchObject({ kind: 'servidor' })
  })

  it('classifica falha de rede sem travar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(chamar('/qualquer')).rejects.toMatchObject({ kind: 'rede' })
  })

  it('classifica resposta que não é JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>erro</html>', { status: 200 })),
    )
    await expect(chamar('/qualquer')).rejects.toMatchObject({
      kind: 'resposta_invalida',
    })
  })

  it('acusa configuração ausente antes de tentar a rede', async () => {
    vi.stubEnv('EVOLUTION_API_URL', '')
    const fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)

    await expect(chamar('/qualquer')).rejects.toMatchObject({
      kind: 'configuracao',
    })
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('é um EvolutionError de verdade, capturável por instanceof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, 401)))
    await expect(chamar('/qualquer')).rejects.toBeInstanceOf(EvolutionError)
  })
})
