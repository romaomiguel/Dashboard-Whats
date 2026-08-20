import { NextResponse } from 'next/server'
import { chamar } from '@/lib/evolution/client'
import { endpoints } from '@/lib/evolution/endpoints'
import { criarClienteAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
/** Teto do plano free da Vercel; o lote é dimensionado para caber nele. */
export const maxDuration = 60

/**
 * Quantas mensagens saem por execução.
 *
 * Pequeno de propósito: disparo em rajada é o caminho mais rápido para o
 * WhatsApp bloquear o número, e o lote precisa terminar dentro do tempo da
 * função. O que sobra vai na execução seguinte do cron.
 */
const TAMANHO_LOTE = 10
const PAUSA_ENTRE_ENVIOS_MS = 1200

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Envia as mensagens vencidas.
 *
 * Vive fora do app porque não há sessão de usuário num cron: usa a service
 * role e é protegida pelo WEBHOOK_SECRET no caminho.
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

async function processar(segredo: string | null | undefined) {
  const esperado = process.env.WEBHOOK_SECRET

  // 404 em vez de 401: não confirma para um sondador que a rota existe.
  if (!esperado || segredo !== esperado) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })
  }

  const admin = criarClienteAdmin()
  const agora = new Date().toISOString()

  const { data: disparos, error } = await admin
    .from('disparos')
    .select('id, mensagem, instance_id, status')
    .in('status', ['agendado', 'enviando'])
    .lte('agendado_para', agora)
    .order('agendado_para')
    .limit(3)

  if (error) {
    return NextResponse.json({ erro: 'falha ao ler a fila' }, { status: 500 })
  }

  const relatorio: { disparo: string; enviados: number; falhas: number }[] = []

  for (const disparo of disparos ?? []) {
    const { data: instancia } = await admin
      .from('instances')
      .select('evolution_name')
      .eq('id', disparo.instance_id)
      .maybeSingle()

    if (!instancia) continue

    const { data: pendentes } = await admin
      .from('disparo_envios')
      .select('id, numero')
      .eq('disparo_id', disparo.id)
      .eq('status', 'pendente')
      .limit(TAMANHO_LOTE)

    if (!pendentes || pendentes.length === 0) {
      await admin
        .from('disparos')
        .update({ status: 'concluido', atualizado_em: new Date().toISOString() })
        .eq('id', disparo.id)
      continue
    }

    if (disparo.status !== 'enviando') {
      await admin
        .from('disparos')
        .update({ status: 'enviando', atualizado_em: new Date().toISOString() })
        .eq('id', disparo.id)
    }

    let enviados = 0
    let falhas = 0

    for (const envio of pendentes) {
      try {
        await chamar(endpoints.mensagem.texto(String(instancia.evolution_name)), {
          metodo: 'POST',
          corpo: { number: envio.numero, text: disparo.mensagem },
        })

        await admin
          .from('disparo_envios')
          .update({ status: 'enviado', enviado_em: new Date().toISOString() })
          .eq('id', envio.id)

        enviados += 1
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : 'erro desconhecido'
        console.error('[disparo]', disparo.id, envio.numero, motivo)

        await admin
          .from('disparo_envios')
          .update({ status: 'falhou', erro: motivo.slice(0, 300) })
          .eq('id', envio.id)

        falhas += 1
      }

      await dormir(PAUSA_ENTRE_ENVIOS_MS)
    }

    // Recontar a partir das linhas evita que dois cron sobrepostos somem duas
    // vezes o mesmo envio.
    const { count: totalEnviados } = await admin
      .from('disparo_envios')
      .select('id', { count: 'exact', head: true })
      .eq('disparo_id', disparo.id)
      .eq('status', 'enviado')

    const { count: totalFalhas } = await admin
      .from('disparo_envios')
      .select('id', { count: 'exact', head: true })
      .eq('disparo_id', disparo.id)
      .eq('status', 'falhou')

    const { count: restantes } = await admin
      .from('disparo_envios')
      .select('id', { count: 'exact', head: true })
      .eq('disparo_id', disparo.id)
      .eq('status', 'pendente')

    await admin
      .from('disparos')
      .update({
        enviados: totalEnviados ?? 0,
        falhas: totalFalhas ?? 0,
        status: (restantes ?? 0) > 0 ? 'enviando' : 'concluido',
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', disparo.id)

    relatorio.push({ disparo: String(disparo.id), enviados, falhas })
  }

  return NextResponse.json({ ok: true, processados: relatorio })
}
