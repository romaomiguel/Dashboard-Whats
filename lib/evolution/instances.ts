import { chamar, type OpcoesChamada } from './client'
import { endpoints } from './endpoints'
import { EvolutionError } from './errors'
import type {
  EstadoConexao,
  RespostaConectar,
  RespostaCriarInstancia,
  RespostaEstadoConexao,
} from './types'

/** Eventos que o dashboard consome. Assinar o mínimo reduz carga no servidor. */
export const EVENTOS_WEBHOOK = [
  'QRCODE_UPDATED',
  'CONNECTION_UPDATE',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'SEND_MESSAGE',
  'CONTACTS_UPSERT',
] as const

/**
 * Nome opaco, sem identidade do usuário: ele aparece em logs da Evolution.
 */
export function gerarNomeInstancia(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `inst_${hex}`
}

export function criarInstancia(
  nome: string,
  urlWebhook: string,
  opcoes: Pick<OpcoesChamada, 'timeoutMs'> = {},
) {
  return chamar<RespostaCriarInstancia>(endpoints.instancia.criar(), {
    ...opcoes,
    metodo: 'POST',
    corpo: {
      instanceName: nome,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        url: urlWebhook,
        byEvents: false,
        base64: false,
        events: [...EVENTOS_WEBHOOK],
      },
    },
  })
}

export function conectarInstancia(
  nome: string,
  opcoes: Pick<OpcoesChamada, 'timeoutMs'> = {},
) {
  return chamar<RespostaConectar>(endpoints.instancia.conectar(nome), opcoes)
}

export async function estadoInstancia(nome: string): Promise<EstadoConexao> {
  try {
    const resposta = await chamar<RespostaEstadoConexao>(
      endpoints.instancia.estado(nome),
    )
    return resposta.instance?.state ?? 'close'
  } catch (erro) {
    // Instância que não existe mais equivale a desconectada.
    if (erro instanceof EvolutionError && erro.kind === 'instancia_inexistente') {
      return 'close'
    }
    throw erro
  }
}

export async function desconectarInstancia(nome: string): Promise<void> {
  await chamar(endpoints.instancia.logout(nome), { metodo: 'DELETE' })
}

export async function removerInstancia(nome: string): Promise<void> {
  try {
    await chamar(endpoints.instancia.deletar(nome), { metodo: 'DELETE' })
  } catch (erro) {
    // Remover o que já não existe é sucesso.
    if (erro instanceof EvolutionError && erro.kind === 'instancia_inexistente') {
      return
    }
    throw erro
  }
}
