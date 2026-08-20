import { NextResponse } from 'next/server'
import { processarLote } from '@/lib/disparos/processador'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
/** Teto do plano free da Vercel; o lote é dimensionado para caber nele. */
export const maxDuration = 60

/**
 * Envia as campanhas vencidas.
 *
 * Usa service role porque não há sessão de usuário num cron, e se protege
 * pelo WEBHOOK_SECRET na query.
 *
 * A Vercel no plano free só roda cron uma vez por dia, então quem chama isto
 * de minuto em minuto é um agendador externo (cron-job.org).
 */
export async function POST(request: Request) {
  return processar(new URL(request.url).searchParams.get('chave'))
}

// Alguns agendadores só fazem GET.
export async function GET(request: Request) {
  return processar(new URL(request.url).searchParams.get('chave'))
}

async function processar(segredo: string | null) {
  const esperado = process.env.WEBHOOK_SECRET

  // 404 em vez de 401: não confirma para um sondador que a rota existe.
  if (!esperado || segredo !== esperado) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })
  }

  const admin = criarClienteAdmin()

  const { data: disparos, error } = await admin
    .from('disparos')
    .select('id, mensagem, instance_id, status')
    .in('status', ['agendado', 'enviando'])
    .lte('agendado_para', new Date().toISOString())
    .order('agendado_para')
    .limit(3)

  if (error) {
    console.error('[disparo] falha ao ler a fila:', error.message)
    return NextResponse.json({ erro: 'falha ao ler a fila' }, { status: 500 })
  }

  const processados = []
  for (const disparo of disparos ?? []) {
    const resultado = await processarLote(admin, disparo)
    if (resultado) processados.push(resultado)
  }

  return NextResponse.json({ ok: true, processados })
}
