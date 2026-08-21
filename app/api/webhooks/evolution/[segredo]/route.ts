import { NextResponse } from 'next/server'
import { numeroDoContato, type ChaveMensagem } from '@/lib/evolution/jid'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import type { EventoWebhook } from '@/lib/evolution/types'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'
import { deveNotificarQueda } from '@/lib/notificacoes'

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

/** Ordem do funil: um recibo nunca pode rebaixar o que já se sabe. */
const POSICAO: Record<string, number> = {
  enviada: 1,
  entregue: 2,
  lida: 3,
}

/**
 * Aplica o recibo de entrega ou leitura à mensagem correspondente.
 *
 * O casamento é pelo id que a Evolution devolveu no envio e que o disparo
 * guardou em mensagem_key.
 */
async function registrarRecibo(evento: EventoWebhook) {
  const dados = evento.data as {
    key?: { id?: string }
    status?: string
  } | null

  const chave = dados?.key?.id
  const bruto = String(dados?.status ?? '').toUpperCase()
  if (!chave) return

  const novo =
    bruto === 'READ' || bruto === 'PLAYED'
      ? 'lida'
      : bruto === 'DELIVERY_ACK'
        ? 'entregue'
        : null

  if (!novo) return

  const admin = criarClienteAdmin()

  const { data: mensagem } = await admin
    .from('mensagens')
    .select('id, status')
    .eq('mensagem_key', chave)
    .maybeSingle()

  if (!mensagem) return

  // Fora de ordem acontece: leitura pode chegar antes da entrega.
  const atual = POSICAO[String(mensagem.status)] ?? 0
  if (atual >= POSICAO[novo]) return

  await admin.from('mensagens').update({ status: novo }).eq('id', mensagem.id)
}

/**
 * Grava a mensagem que passou pelo WhatsApp, nas duas direções.
 *
 * O que sai também entra aqui: antes só o disparo gravava saída, então
 * responder pelo celular não aparecia em lugar nenhum e a conversa ficava
 * eternamente como "a pessoa respondeu". O índice único em mensagem_key
 * impede que a mensagem do disparo entre duas vezes.
 */
async function registrarRecebida(evento: EventoWebhook) {
  const dados = evento.data as {
    key?: ChaveMensagem & { id?: string }
    pushName?: string
  } | null

  if (!dados?.key) return

  const daPropriaConta = Boolean(dados.key.fromMe)

  // Trata os dois endereçamentos do WhatsApp, o antigo e o LID; descarta
  // grupo, transmissão e newsletter.
  const numero = numeroDoContato(dados.key)
  if (!numero) return

  const texto = textoDaMensagem(evento.data)
  if (!texto) return

  const admin = criarClienteAdmin()

  const { data: instancia } = await admin
    .from('instances')
    .select('id, owner_id')
    .eq('evolution_name', evento.instance)
    .maybeSingle()

  if (!instancia) return

  const chave = dados.key.id ? String(dados.key.id) : null

  // A do disparo já foi gravada com esta mesma chave; ignoreDuplicates deixa
  // o índice único resolver, inclusive se os dois chegarem ao mesmo tempo.
  const { error } = await admin.from('mensagens').upsert(
    {
      owner_id: instancia.owner_id,
      instance_id: instancia.id,
      numero,
      // pushName é de quem enviou: numa mensagem própria seria o nome do
      // usuário, não o do contato.
      nome: daPropriaConta ? null : (dados.pushName ?? null),
      direcao: daPropriaConta ? 'saida' : 'entrada',
      status: daPropriaConta ? 'enviada' : 'recebida',
      texto: texto.slice(0, 4096),
      mensagem_key: chave,
    },
    { onConflict: 'mensagem_key', ignoreDuplicates: true },
  )

  // Sem isto, uma falha de gravação sumia sem deixar rastro e o sintoma era
  // apenas "a mensagem não aparece na tela".
  if (error) {
    console.error('[webhook] não gravou a mensagem:', error.code, error.message)
  }

  // Só resposta de contato vira notificação: o que sai do próprio número não
  // é novidade para quem enviou.
  if (!daPropriaConta) {
    await registrarNotificacao(admin, String(instancia.owner_id), {
      tipo: 'mensagem',
      numero,
      nome: dados.pushName ?? null,
      texto,
    })
  }
}

/**
 * Mantém `instances.status` sincronizado com o que a Evolution reporta, nas
 * duas direções, e avisa só quando a conexão cai.
 *
 * A volta (`open`) precisa gravar também: sem isto, depois de cair, notificar
 * e reconectar sozinha (a Evolution insiste), o banco continuava dizendo
 * "desconectada" para sempre — só `verificarConexao` corrigia, e ela só roda
 * com a tela de Conexão aberta. Pior: a PRÓXIMA queda de verdade deixava de
 * notificar, porque `deveNotificarQueda` exige que o estado anterior fosse
 * "conectada". Reconectar é boa notícia, então este caminho nunca notifica.
 */
async function registrarConexao(evento: EventoWebhook) {
  const dados = evento.data as { state?: string; statusReason?: number } | null
  const estadoNovo = String(dados?.state ?? '')

  const admin = criarClienteAdmin()

  const { data: instancia } = await admin
    .from('instances')
    .select('id, owner_id, nome, status')
    .eq('evolution_name', evento.instance)
    .maybeSingle()

  if (!instancia) return

  if (estadoNovo === 'open') {
    // Nada para gravar se já estava conectada: evita um update por evento
    // redundante que a Evolution manda de tempos em tempos.
    if (String(instancia.status) === 'conectada') return

    await admin
      .from('instances')
      .update({ status: 'conectada', atualizado_em: new Date().toISOString() })
      .eq('id', instancia.id)
    return
  }

  if (!deveNotificarQueda(String(instancia.status), estadoNovo)) return

  // O banco precisa refletir a queda, senão a tela seguiria dizendo conectada
  // até alguém abrir Conexão.
  await admin
    .from('instances')
    .update({ status: 'desconectada', atualizado_em: new Date().toISOString() })
    .eq('id', instancia.id)

  await registrarNotificacao(admin, String(instancia.owner_id), {
    tipo: 'conexao',
    id: String(instancia.id),
    nome: String(instancia.nome),
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

  // Falha aqui não pode virar erro para a Evolution: ela reenviaria o evento
  // em laço.
  try {
    const tipo = evento.event.toUpperCase().replace('.', '_')
    if (tipo === 'MESSAGES_UPSERT') await registrarRecebida(evento)
    if (tipo === 'MESSAGES_UPDATE') await registrarRecibo(evento)
    if (tipo === 'CONNECTION_UPDATE') await registrarConexao(evento)
  } catch (erro) {
    console.error('[webhook] falha ao processar evento:', erro)
  }

  // Responder 200 rápido é obrigatório: a Evolution reenvia o que falhar.
  return NextResponse.json({ ok: true })
}
