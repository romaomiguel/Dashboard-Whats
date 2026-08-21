import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DIAS_RETENCAO,
  montarNotificacao,
  PREFERENCIA_POR_TIPO,
  type EventoNotificavel,
} from '@/lib/notificacoes'

/**
 * Único ponto de gravação de notificação.
 *
 * Concentra o portão de preferência, a montagem do texto e a retenção, de
 * modo que os produtores só precisem relatar o que aconteceu. Recebe o
 * cliente pronto porque roda em dois contextos: no receptor de webhook, com
 * service role e sem sessão, e no processador de disparos.
 *
 * Devolve se gravou. Falha de banco vira `false` e log, nunca exceção: uma
 * notificação perdida é menos grave que um evento de webhook reenviado em
 * laço ou um disparo interrompido.
 */
export async function registrarNotificacao(
  db: SupabaseClient,
  ownerId: string,
  evento: EventoNotificavel,
): Promise<boolean> {
  const coluna = PREFERENCIA_POR_TIPO[evento.tipo]

  const { data: perfil } = await db
    .from('profiles')
    .select(coluna)
    .eq('id', ownerId)
    .maybeSingle()

  // Coluna ausente (migration não rodada) faz o PostgREST devolver erro e
  // `data: null` — não um objeto sem essa chave. `perfil` vem nulo, então
  // `preferencia` fica undefined, não false, e o padrão abaixo é notificar:
  // sumir em silêncio seria pior que uma notificação a mais.
  const preferencia = (perfil as Record<string, unknown> | null)?.[coluna]
  if (preferencia === false) return false

  const montada = montarNotificacao(evento)
  const agora = new Date().toISOString()

  const { error } = await db.from('notificacoes').upsert(
    {
      owner_id: ownerId,
      tipo: montada.tipo,
      chave: montada.chave,
      titulo: montada.titulo,
      corpo: montada.corpo,
      destino: montada.destino,
      // Atividade nova volta a pedir atenção, ainda que já tivesse sido lida.
      lida: false,
      atualizado_em: agora,
    },
    { onConflict: 'owner_id,chave' },
  )

  if (error) {
    console.error('[notificacao] não gravou:', error.code, error.message)
    return false
  }

  // A notificação já foi gravada: falha na limpeza não pode voltar atrás e
  // transformar esse sucesso em `false`, nem subir como exceção — o portão
  // de erro é só o do upsert acima.
  await limparAntigas(db, ownerId)
  return true
}

/**
 * Retenção junto da gravação, e não numa rotina agendada.
 *
 * O cron de disparos é opcional e pode nunca ser configurado; retenção que
 * depende de algo opcional não é retenção. A consulta usa o índice do sino.
 *
 * Nunca deixa erro subir: quem chama já gravou a notificação e não pode
 * receber uma exceção por causa de limpeza, sob pena de o webhook devolver
 * erro para a Evolution (que reenvia em laço) ou um disparo parar no meio
 * do lote.
 */
async function limparAntigas(db: SupabaseClient, ownerId: string) {
  const limite = new Date(
    Date.now() - DIAS_RETENCAO * 24 * 60 * 60 * 1000,
  ).toISOString()

  try {
    const { error } = await db
      .from('notificacoes')
      .delete()
      .eq('owner_id', ownerId)
      .eq('lida', true)
      .lt('atualizado_em', limite)

    if (error) {
      console.error('[notificacao] retenção não limpou:', error.code, error.message)
    }
  } catch (erro) {
    console.error('[notificacao] retenção rejeitou:', erro)
  }
}
