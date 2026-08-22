import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'
import { POST } from '../route'

// Sem isto, cada teste que chega ao despacho de CONNECTION_UPDATE fazia um
// round-trip de verdade ao Supabase (~685ms medido em revisão) porque
// `criarClienteAdmin` não era simulado.
const banco = vi.hoisted(() => ({
  instancia: null as
    | { id: string; owner_id: string; nome: string; status: string }
    | null,
  atualizacoesInstancia: [] as Record<string, unknown>[],
  // Mensagens gravadas via upsert em MESSAGES_UPSERT — só o suficiente para
  // não estourar a tabela não simulada; os testes do funil não checam isto.
  mensagens: [] as Record<string, unknown>[],
}))

const funil = vi.hoisted(() => ({ registrar: vi.fn() }))

vi.mock('@/lib/funil/registrar', () => ({
  registrarNoFunil: (...args: unknown[]) => funil.registrar(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  criarClienteAdmin: () => ({
    from(tabela: string) {
      if (tabela === 'mensagens') {
        return {
          upsert: async (valores: Record<string, unknown>) => {
            banco.mensagens.push(valores)
            return { error: null }
          },
        }
      }
      if (tabela !== 'instances') {
        throw new Error(`tabela não simulada nos testes do webhook: ${tabela}`)
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: banco.instancia }),
          }),
        }),
        update: (valores: Record<string, unknown>) => ({
          eq: async () => {
            banco.atualizacoesInstancia.push(valores)
            return { error: null }
          },
        }),
      }
    },
  }),
}))

vi.mock('@/lib/notificacoes/registrar', () => ({
  registrarNotificacao: vi.fn(async () => true),
}))

const registrarNotificacaoMock = vi.mocked(registrarNotificacao)

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

function eventoQueda() {
  return {
    event: 'connection.update',
    instance: 'inst_a1b2c3d4',
    data: { state: 'close' },
  }
}

describe('POST /api/webhooks/evolution/[segredo]', () => {
  beforeEach(() => {
    vi.stubEnv('WEBHOOK_SECRET', 'segredo-certo')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    banco.instancia = null
    banco.atualizacoesInstancia = []
    banco.mensagens = []
    funil.registrar.mockClear()
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

  describe('CONNECTION_UPDATE', () => {
    it('estado fechado vindo de conectada grava o status novo e notifica', async () => {
      banco.instancia = {
        id: 'inst-1',
        owner_id: 'user-1',
        nome: 'Comercial',
        status: 'conectada',
      }

      const resposta = await POST(requisicao(eventoQueda()), {
        params: Promise.resolve({ segredo: 'segredo-certo' }),
      })

      expect(resposta.status).toBe(200)
      expect(banco.atualizacoesInstancia).toEqual([
        expect.objectContaining({ status: 'desconectada' }),
      ])
      expect(registrarNotificacaoMock).toHaveBeenCalledTimes(1)
      expect(registrarNotificacaoMock).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        { tipo: 'conexao', id: 'inst-1', nome: 'Comercial' },
      )
    })

    // Toda instância nasce fechada: sem a condição de vir de conectada, criar
    // uma conexão avisaria queda antes de o QR ser lido.
    it.each(['criada', 'conectando'])(
      'estado fechado vindo de %s não notifica nem grava',
      async (statusAnterior) => {
        banco.instancia = {
          id: 'inst-1',
          owner_id: 'user-1',
          nome: 'Comercial',
          status: statusAnterior,
        }

        const resposta = await POST(requisicao(eventoQueda()), {
          params: Promise.resolve({ segredo: 'segredo-certo' }),
        })

        expect(resposta.status).toBe(200)
        expect(banco.atualizacoesInstancia).toHaveLength(0)
        expect(registrarNotificacaoMock).not.toHaveBeenCalled()
      },
    )

    it('conexão inexistente não estoura', async () => {
      banco.instancia = null

      const resposta = await POST(requisicao(eventoQueda()), {
        params: Promise.resolve({ segredo: 'segredo-certo' }),
      })

      expect(resposta.status).toBe(200)
      await expect(resposta.json()).resolves.toEqual({ ok: true })
      expect(registrarNotificacaoMock).not.toHaveBeenCalled()
    })

    // A queda é gravada; sem a volta também ser gravada aqui, o banco segue
    // dizendo "desconectada" para sempre depois de uma reconexão automática, e
    // a PRÓXIMA queda de verdade deixa de notificar (deveNotificarQueda exige
    // estado anterior "conectada").
    it('estado aberto vindo de desconectada grava conectada e não notifica', async () => {
      banco.instancia = {
        id: 'inst-1',
        owner_id: 'user-1',
        nome: 'Comercial',
        status: 'desconectada',
      }

      const resposta = await POST(requisicao(evento), {
        params: Promise.resolve({ segredo: 'segredo-certo' }),
      })

      expect(resposta.status).toBe(200)
      expect(banco.atualizacoesInstancia).toEqual([
        expect.objectContaining({ status: 'conectada' }),
      ])
      // Reconectar é boa notícia, não alerta.
      expect(registrarNotificacaoMock).not.toHaveBeenCalled()
    })

    it('estado aberto vindo de já conectada não grava de novo', async () => {
      banco.instancia = {
        id: 'inst-1',
        owner_id: 'user-1',
        nome: 'Comercial',
        status: 'conectada',
      }

      const resposta = await POST(requisicao(evento), {
        params: Promise.resolve({ segredo: 'segredo-certo' }),
      })

      expect(resposta.status).toBe(200)
      expect(banco.atualizacoesInstancia).toHaveLength(0)
      expect(registrarNotificacaoMock).not.toHaveBeenCalled()
    })
  })

  describe('MESSAGES_UPSERT', () => {
    beforeEach(() => {
      banco.instancia = {
        id: 'inst-1',
        owner_id: 'user-1',
        nome: 'Comercial',
        status: 'conectada',
      }
    })

    function eventoDeMensagemRecebida() {
      return {
        event: 'messages.upsert',
        instance: 'inst_a1b2c3d4',
        data: {
          key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false, id: 'MSG-1' },
          pushName: 'Fulano',
          message: { conversation: 'Oi' },
        },
      }
    }

    function eventoDeMensagemPropria() {
      return {
        event: 'messages.upsert',
        instance: 'inst_a1b2c3d4',
        data: {
          key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: true, id: 'MSG-2' },
          message: { conversation: 'Oi, aqui é a empresa' },
        },
      }
    }

    // Quem te escreve entra no funil mesmo sem estar em Contatos — é o caso
    // que a esteira por contato não cobria.
    it('inscreve a conversa recebida no funil', async () => {
      await POST(requisicao(eventoDeMensagemRecebida()), {
        params: Promise.resolve({ segredo: 'segredo-certo' }),
      })

      expect(funil.registrar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ direcao: 'entrada' }),
      )
    })

    // O eco `fromMe` da própria conta é saída: inscreve, mas não promove.
    it('marca o eco da própria conta como saída', async () => {
      await POST(requisicao(eventoDeMensagemPropria()), {
        params: Promise.resolve({ segredo: 'segredo-certo' }),
      })

      expect(funil.registrar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ direcao: 'saida' }),
      )
    })
  })
})
