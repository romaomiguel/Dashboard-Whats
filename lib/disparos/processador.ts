import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { chamar } from '@/lib/evolution/client'
import { endpoints } from '@/lib/evolution/endpoints'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'

/**
 * Quantas mensagens saem por execução.
 *
 * Pequeno de propósito: disparo em rajada é o caminho mais rápido para o
 * WhatsApp bloquear o número, e o lote precisa terminar dentro do tempo da
 * função. O que sobra vai na execução seguinte.
 */
export const TAMANHO_LOTE = 10
export const PAUSA_ENTRE_ENVIOS_MS = 1200

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type ResultadoLote = {
  disparo: string
  enviados: number
  falhas: number
  restantes: number
}

/**
 * Envia um lote de uma campanha e atualiza os contadores.
 *
 * Recebe o cliente pronto porque roda em dois contextos: pela rota do cron,
 * com service role e sem sessão, e por ação do usuário, com a sessão dele.
 */
export async function processarLote(
  db: SupabaseClient,
  disparo: { id: string; mensagem: string; instance_id: string; status: string },
): Promise<ResultadoLote | null> {
  const { data: instancia } = await db
    .from('instances')
    .select('id, owner_id, evolution_name')
    .eq('id', disparo.instance_id)
    .maybeSingle()

  if (!instancia) return null

  const { data: pendentes } = await db
    .from('disparo_envios')
    .select('id, numero, nome')
    .eq('disparo_id', disparo.id)
    .eq('status', 'pendente')
    .limit(TAMANHO_LOTE)

  if (!pendentes || pendentes.length === 0) {
    await db
      .from('disparos')
      .update({ status: 'concluido', atualizado_em: new Date().toISOString() })
      .eq('id', disparo.id)
    return { disparo: disparo.id, enviados: 0, falhas: 0, restantes: 0 }
  }

  if (disparo.status !== 'enviando') {
    await db
      .from('disparos')
      .update({ status: 'enviando', atualizado_em: new Date().toISOString() })
      .eq('id', disparo.id)
  }

  let enviados = 0
  let falhas = 0

  for (const envio of pendentes) {
    const numero = String(envio.numero)
    let erro: string | null = null
    let chave: string | null = null

    try {
      const resposta = await chamar<{ key?: { id?: string } }>(
        endpoints.mensagem.texto(String(instancia.evolution_name)),
        {
          metodo: 'POST',
          corpo: { number: numero, text: disparo.mensagem },
        },
      )
      // Guardar o id é o que permite ao webhook dizer depois se foi entregue
      // e se foi lida.
      chave = resposta?.key?.id ?? null
      enviados += 1
    } catch (causa) {
      erro = causa instanceof Error ? causa.message : 'erro desconhecido'
      console.error('[disparo]', disparo.id, numero, erro)
      falhas += 1
    }

    await db
      .from('disparo_envios')
      .update(
        erro
          ? { status: 'falhou', erro: erro.slice(0, 300) }
          : { status: 'enviado', enviado_em: new Date().toISOString() },
      )
      .eq('id', envio.id)

    // Registrar na conversa mesmo quando falha: sem isso, a tela de Mensagens
    // não explicaria por que um contato não recebeu nada.
    await db.from('mensagens').insert({
      owner_id: instancia.owner_id,
      instance_id: instancia.id,
      disparo_id: disparo.id,
      numero,
      nome: envio.nome ? String(envio.nome) : null,
      direcao: 'saida',
      status: erro ? 'falhou' : 'enviada',
      texto: disparo.mensagem,
      erro: erro ? erro.slice(0, 300) : null,
      mensagem_key: chave,
    })

    await dormir(PAUSA_ENTRE_ENVIOS_MS)
  }

  // Recontar a partir das linhas evita que duas execuções sobrepostas somem
  // duas vezes o mesmo envio.
  const contar = async (status: string) => {
    const { count } = await db
      .from('disparo_envios')
      .select('id', { count: 'exact', head: true })
      .eq('disparo_id', disparo.id)
      .eq('status', status)
    return count ?? 0
  }

  const [totalEnviados, totalFalhas, restantes] = await Promise.all([
    contar('enviado'),
    contar('falhou'),
    contar('pendente'),
  ])

  const concluiu = restantes === 0

  await db
    .from('disparos')
    .update({
      enviados: totalEnviados,
      falhas: totalFalhas,
      status: concluiu ? 'concluido' : 'enviando',
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', disparo.id)

  // Só na virada para concluído: notificar a cada lote encheria o sino de
  // repetição da mesma campanha.
  if (concluiu) {
    const { data: campanha } = await db
      .from('disparos')
      .select('nome, total')
      .eq('id', disparo.id)
      .maybeSingle()

    if (campanha) {
      await registrarNotificacao(db, String(instancia.owner_id), {
        tipo: 'disparo',
        id: disparo.id,
        nome: String(campanha.nome),
        enviados: totalEnviados,
        total: Number(campanha.total),
      })
    }
  }

  return { disparo: disparo.id, enviados, falhas, restantes }
}
