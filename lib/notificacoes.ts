import { chaveDoNumero } from '@/lib/numeros'

export const TIPOS_NOTIFICACAO = ['mensagem', 'disparo', 'conexao'] as const

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number]

export type Notificacao = {
  id: string
  tipo: TipoNotificacao
  titulo: string
  corpo: string | null
  destino: string | null
  lida: boolean
  quando: string
}

/** Coluna de `profiles` que decide se cada tipo chega a ser criado. */
export const PREFERENCIA_POR_TIPO = {
  mensagem: 'notificar_mensagem',
  disparo: 'notificar_disparo',
  conexao: 'notificar_conexao',
} as const

export type ColunaPreferencia =
  (typeof PREFERENCIA_POR_TIPO)[TipoNotificacao]

export const DIAS_RETENCAO = 30

/** Corpo mais longo que isto vira parede de texto no painel. */
const LIMITE_CORPO = 120

export type EventoNotificavel =
  | { tipo: 'mensagem'; numero: string; nome: string | null; texto: string }
  | { tipo: 'disparo'; id: string; nome: string; enviados: number; total: number }
  | { tipo: 'conexao'; id: string; nome: string }

export type NotificacaoMontada = {
  tipo: TipoNotificacao
  chave: string
  titulo: string
  corpo: string | null
  destino: string
}

function encurtar(texto: string): string {
  const limpo = texto.trim()
  if (limpo.length <= LIMITE_CORPO) return limpo
  return `${limpo.slice(0, LIMITE_CORPO - 1)}…`
}

/**
 * Traduz um evento do sistema em notificação.
 *
 * Função pura de propósito: é aqui que mora todo o texto que o usuário lê, e
 * dá para testá-la sem banco nem webhook.
 */
export function montarNotificacao(evento: EventoNotificavel): NotificacaoMontada {
  if (evento.tipo === 'mensagem') {
    // Chave canônica: o WhatsApp devolve o número brasileiro sem o nono
    // dígito, e sem isto a mesma pessoa geraria duas notificações.
    const numero = chaveDoNumero(evento.numero)
    return {
      tipo: 'mensagem',
      chave: `mensagem:${numero}`,
      titulo: `${evento.nome ?? numero} respondeu`,
      corpo: encurtar(evento.texto),
      destino: `/mensagens?busca=${encodeURIComponent(numero)}`,
    }
  }

  if (evento.tipo === 'disparo') {
    return {
      tipo: 'disparo',
      chave: `disparo:${evento.id}`,
      titulo: `${evento.nome} concluída`,
      corpo: `${evento.enviados.toLocaleString('pt-BR')} de ${evento.total.toLocaleString('pt-BR')} enviadas`,
      destino: '/disparos',
    }
  }

  return {
    tipo: 'conexao',
    chave: `conexao:${evento.id}`,
    titulo: `${evento.nome} desconectou`,
    corpo: 'Leia o QR code para reconectar.',
    destino: '/conexao',
  }
}
