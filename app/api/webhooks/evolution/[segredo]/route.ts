import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import type { EventoWebhook } from '@/lib/evolution/types'

/** Texto da mensagem, nas formas que a Evolution usa conforme o tipo. */
function textoDaMensagem(dados: unknown): string | null {
  if (!dados || typeof dados !== 'object') return null
  const m = (dados as { message?: Record<string, unknown> }).message
  if (!m) return null

  if (typeof m.conversation === 'string') return m.conversation
  const estendida = m.extendedTextMessage as { text?: string } | undefined
  if (typeof estendida?.text === 'string') return estendida.text

  // Mídia sem legenda ainda merece aparecer na conversa.
  for (const chave of ['imageMessage', 'videoMessage', 'documentMessage']) {
    const parte = m[chave] as { caption?: string } | undefined
    if (parte) return parte.caption ?? '[mídia]'
  }
  if (m.audioMessage) return '[áudio]'
  return null
}

/** Grava a mensagem recebida, para a tela de Mensagens ter o que mostrar. */
async function registrarRecebida(evento: EventoWebhook) {
  const dados = evento.data as {
    key?: { remoteJid?: string; fromMe?: boolean }
    pushName?: string
  } | null

  // Mensagem que o próprio número enviou já foi registrada pelo disparo.
  if (!dados?.key || dados.key.fromMe) return

  const jid = String(dados.key.remoteJid ?? '')
  // Grupo tem outro sufixo e não é conversa de contato.
  if (!jid.endsWith('@s.whatsapp.net')) return

  const texto = textoDaMensagem(evento.data)
  if (!texto) return

  const admin = criarClienteAdmin()

  const { data: instancia } = await admin
    .from('instances')
    .select('id, owner_id')
    .eq('evolution_name', evento.instance)
    .maybeSingle()

  if (!instancia) return

  await admin.from('mensagens').insert({
    owner_id: instancia.owner_id,
    instance_id: instancia.id,
    numero: jid.split('@')[0],
    nome: dados.pushName ?? null,
    direcao: 'entrada',
    status: 'recebida',
    texto: texto.slice(0, 4096),
  })
}

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ segredo: string }> },
) {
  const { segredo } = await params
  const esperado = process.env.WEBHOOK_SECRET

  // Segredo ausente na configuração nunca deve liberar a rota.
  // 404 em vez de 401: não confirma para um sondador que o caminho existe.
  if (!esperado || segredo !== esperado) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })
  }

  let evento: EventoWebhook | null = null
  try {
    evento = (await request.json()) as EventoWebhook
  } catch {
    return NextResponse.json({ erro: 'json inválido' }, { status: 400 })
  }

  if (!evento?.instance || !evento?.event) {
    return NextResponse.json({ erro: 'evento incompleto' }, { status: 400 })
  }

  console.info('[webhook]', evento.event, evento.instance)

  if (evento.event === 'messages.upsert' || evento.event === 'MESSAGES_UPSERT') {
    // Falha aqui não pode virar erro para a Evolution: ela reenviaria o
    // evento em laço.
    try {
      await registrarRecebida(evento)
    } catch (erro) {
      console.error('[webhook] falha ao gravar mensagem recebida:', erro)
    }
  }

  // Responder 200 rápido é obrigatório: a Evolution reenvia o que falhar.
  return NextResponse.json({ ok: true })
}
