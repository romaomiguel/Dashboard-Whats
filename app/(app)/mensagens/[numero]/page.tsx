import {
  listarMensagensDaConversa,
  type MensagemDaConversa,
} from '@/lib/consultas/conversa'
import { Thread } from './thread'

/**
 * Quem se identificou fica: como em `listarConversas`
 * (lib/consultas/mensagens.ts), o pushName do WhatsApp só chega junto das
 * mensagens recebidas, então boa parte das linhas tem `nome: null`. Percorre
 * de trás para frente (a lista vem cronológica, então o fim é o mais recente)
 * e usa a primeira que tiver — cai no número só se ninguém nunca se
 * identificou.
 */
function nomeDaConversa(mensagens: MensagemDaConversa[], numero: string): string {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const nome = mensagens[i].nome
    if (nome) return nome
  }
  return numero
}

export default async function Page({
  params,
}: {
  params: Promise<{ numero: string }>
}) {
  const { numero } = await params
  const mensagens = await listarMensagensDaConversa(numero)

  return (
    <Thread numero={numero} nome={nomeDaConversa(mensagens, numero)} iniciais={mensagens} />
  )
}
