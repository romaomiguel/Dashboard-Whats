'use server'

import { revalidatePath } from 'next/cache'
import { chamar } from '@/lib/evolution/client'
import { endpoints } from '@/lib/evolution/endpoints'
import { mesmoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoEnvio = { erro?: string; ok?: boolean }

/** Limite da coluna `mensagens.texto` e do próprio WhatsApp. */
const LIMITE_TEXTO = 4096

/** Teto de linhas recentes varridas para achar a conexão da conversa. */
const LIMITE_BUSCA_CONEXAO = 200

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
    return {
      erro: 'Não dá para saber por qual conexão responder esta conversa. Abra a conversa a partir de uma mensagem recebida.',
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
  const { error } = await supabase.from('mensagens').insert({
    owner_id: user.id,
    instance_id: ultima.instance_id,
    numero,
    direcao: 'saida',
    status: erroEnvio ? 'falhou' : 'enviada',
    texto: limpo,
    erro: erroEnvio ? erroEnvio.slice(0, 300) : null,
    mensagem_key: chave,
  })

  if (error) return { erro: 'A mensagem saiu, mas não foi possível gravá-la.' }

  revalidatePath(`/mensagens/${numero}`)
  revalidatePath('/mensagens')

  if (erroEnvio) {
    return { erro: 'Não foi possível entregar a mensagem. Ela ficou marcada como falhou na conversa.' }
  }
  return { ok: true }
}
