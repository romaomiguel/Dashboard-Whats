import { NextResponse } from 'next/server'
import type { EventoWebhook } from '@/lib/evolution/types'

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

  // Entrega 1 apenas registra. O processamento (gravar no Supabase e
  // publicar via Realtime) chega na Entrega 2.
  console.info('[webhook]', evento.event, evento.instance)

  // Responder 200 rápido é obrigatório: a Evolution reenvia o que falhar.
  return NextResponse.json({ ok: true })
}
