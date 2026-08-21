'use server'

import { revalidatePath } from 'next/cache'
import { LIMITE_VARREDURA_CONVERSA } from '@/lib/consultas/conversa'
import { chamar } from '@/lib/evolution/client'
import { endpoints } from '@/lib/evolution/endpoints'
import { mesmoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoEnvio = { erro?: string; ok?: boolean }

/** Limite da coluna `mensagens.texto` e do próprio WhatsApp. */
const LIMITE_TEXTO = 4096

/**
 * Teto de linhas recentes varridas para achar a conexão da conversa.
 *
 * É o mesmo da leitura da thread de propósito: com um teto menor aqui, uma
 * conversa um pouco mais antiga abria na tela com o campo de resposta
 * habilitado e recusava o envio — quem tem tráfego alto empurrava a linha da
 * conexão para fora da janela do envio sem tirá-la da janela da leitura.
 */
const LIMITE_BUSCA_CONEXAO = LIMITE_VARREDURA_CONVERSA

/**
 * Responde um contato pela plataforma.
 *
 * A conexão sai da última mensagem da conversa, e não de "a primeira conexão
 * do usuário": com duas conexões, responder pelo número errado quebraria a
 * conversa do lado do contato, que veria a resposta vindo de um
 * desconhecido.
 */
export async function enviarMensagem(
  numero: string,
  texto: string,
): Promise<EstadoEnvio> {
  const limpo = texto.trim()
  if (!limpo) return { erro: 'Escreva alguma coisa antes de enviar.' }
  if (limpo.length > LIMITE_TEXTO) {
    return { erro: `Mensagem muito longa: o limite é ${LIMITE_TEXTO} caracteres.` }
  }

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // O filtro por número acontece em memória, não no Postgres: o disparo grava
  // o número com o nono dígito e o webhook grava sem ele, então `eq('numero')`
  // não encontraria nada para uma conversa nascida de um disparo — como em
  // `listarConversas` (lib/consultas/mensagens.ts) e
  // `listarMensagensDaConversa` (lib/consultas/conversa.ts).
  const { data: recentes } = await supabase
    .from('mensagens')
    .select('instance_id, numero, instances(evolution_name)')
    .order('criado_em', { ascending: false })
    .limit(LIMITE_BUSCA_CONEXAO)

  const linhas = (recentes ?? []) as {
    instance_id?: string
    numero?: unknown
    instances?: { evolution_name?: string }
  }[]

  const ultima = linhas.find((linha) => mesmoNumero(String(linha.numero), numero)) ?? null

  const instancia = ultima?.instances

  if (!ultima || !instancia?.evolution_name) {
    // Sobra só o caso real: nenhuma linha desta conversa aponta para uma
    // conexão utilizável (removida, ou conversa ainda sem histórico). Mandar
    // "abra a conversa a partir de uma mensagem recebida" era pedir de novo o
    // que a pessoa acabou de fazer para chegar até aqui.
    return {
      erro: 'Esta conversa não está ligada a nenhuma conexão ativa. Reconecte o número que a atendeu e tente de novo.',
    }
  }

  let chave: string | null = null
  let erroEnvio: string | null = null

  try {
    const resposta = await chamar<{ key?: { id?: string } }>(
      endpoints.mensagem.texto(String(instancia.evolution_name)),
      { metodo: 'POST', corpo: { number: numero, text: limpo } },
    )
    // Guardar o id é o que permite ao webhook marcar entregue e lida depois.
    chave = resposta?.key?.id ?? null
  } catch (causa) {
    erroEnvio = causa instanceof Error ? causa.message : 'erro desconhecido'
    console.error('[conversa] envio falhou:', numero, erroEnvio)
  }

  // Grava mesmo falhando, como o disparo já faz: sem a linha, a tela não
  // explicaria por que o contato não recebeu nada.
  //
  // Upsert e não insert por causa da corrida com o webhook: o eco `fromMe`
  // desta mesma mensagem chega com a mesma `mensagem_key` e às vezes ganha a
  // corrida. Com insert, o índice único `mensagens_key_unica` estourava 23505,
  // a tela devolvia erro mantendo o texto digitado no campo, e quem apertasse
  // Enviar de novo entregava a mensagem duas vezes ao contato.
  //
  // Quando o envio falhou não há chave: `mensagem_key` fica nulo e o Postgres
  // trata NULL como distinto de NULL, então a linha 'falhou' entra normalmente
  // em vez de colidir com outra sem chave (ver migração 0011).
  const { error } = await supabase.from('mensagens').upsert(
    {
      owner_id: user.id,
      instance_id: ultima.instance_id,
      numero,
      direcao: 'saida',
      status: erroEnvio ? 'falhou' : 'enviada',
      texto: limpo,
      erro: erroEnvio ? erroEnvio.slice(0, 300) : null,
      mensagem_key: chave,
    },
    { onConflict: 'mensagem_key', ignoreDuplicates: true },
  )

  // Duplicidade não é falha para quem enviou: a mensagem saiu e a linha já
  // está na conversa, gravada pelo webhook. Devolver erro aqui é o que levava
  // ao reenvio manual — exatamente o que este upsert existe para evitar.
  if (error && error.code !== '23505') {
    return { erro: 'A mensagem saiu, mas não foi possível gravá-la.' }
  }

  revalidatePath(`/mensagens/${numero}`)
  revalidatePath('/mensagens')

  if (erroEnvio) {
    return { erro: 'Não foi possível entregar a mensagem. Ela ficou marcada como falhou na conversa.' }
  }
  return { ok: true }
}
