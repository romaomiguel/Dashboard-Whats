'use server'

import { revalidatePath } from 'next/cache'
import { LIMITE_ETAPAS, nomeDeEtapaValido, proximaOrdem } from '@/lib/esteira'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoEsteira = { erro?: string; ok?: boolean }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function criarEtapa(nome: string): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const limpo = nome.trim()
  if (!nomeDeEtapaValido(limpo)) {
    return { erro: 'A etapa precisa de um nome de 1 a 24 caracteres.' }
  }

  const { data: existentes } = await supabase
    .from('etapas')
    .select('ordem')
    .eq('owner_id', user.id)

  const ordens = (existentes ?? []).map((e) => Number(e.ordem))

  // Server action é chamável por requisição HTTP direta: o teto precisa
  // valer aqui, não só no botão da tela.
  if (ordens.length >= LIMITE_ETAPAS) {
    return { erro: `Você atingiu o limite de ${LIMITE_ETAPAS} etapas.` }
  }

  const { error } = await supabase.from('etapas').insert({
    owner_id: user.id,
    nome: limpo,
    ordem: proximaOrdem(ordens),
  })

  if (error) {
    if (error.code === '23505') return { erro: 'Você já tem uma etapa com esse nome.' }
    return { erro: 'Não foi possível criar a etapa.' }
  }

  revalidatePath('/esteira')
  return { ok: true }
}

/**
 * Move o contato de etapa e registra a passagem.
 *
 * O histórico guarda o **nome** da etapa, não o id: renomear "Negociando"
 * para "Proposta" não pode reescrever o passado, e apagar a etapa não pode
 * levar o histórico junto.
 */
export async function moverContato(
  contatoId: string,
  etapaId: string | null,
): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: contato } = await supabase
    .from('contatos')
    .select('id, etapa_id, etapas(nome)')
    .eq('id', contatoId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!contato) return { erro: 'Contato não encontrado.' }

  let nomeDestino = 'Sem etapa'
  if (etapaId) {
    const { data: destino } = await supabase
      .from('etapas')
      .select('nome')
      .eq('id', etapaId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!destino) return { erro: 'Etapa não encontrada.' }
    nomeDestino = String(destino.nome)
  }

  const { error } = await supabase
    .from('contatos')
    .update({ etapa_id: etapaId, atualizado_em: new Date().toISOString() })
    .eq('id', contatoId)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível mover o contato.' }

  const de = (contato as { etapas?: { nome?: string } }).etapas?.nome ?? null

  // Falha aqui não desfaz a movimentação: o contato já está na etapa certa, e
  // perder uma linha de histórico é menos grave que devolver erro para uma
  // ação que aconteceu.
  const { error: erroHistorico } = await supabase
    .from('contato_etapa_historico')
    .insert({
      owner_id: user.id,
      contato_id: contatoId,
      de,
      para: nomeDestino,
    })

  if (erroHistorico) {
    console.error('[esteira] histórico não gravou:', erroHistorico.code, erroHistorico.message)
  }

  revalidatePath('/esteira')
  return { ok: true }
}

export async function removerEtapa(id: string): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // O `on delete set null` da 0014 devolve os contatos para "sem etapa"; o
  // histórico sobrevive porque guarda o nome, não a referência.
  const { error } = await supabase
    .from('etapas')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível remover a etapa.' }

  revalidatePath('/esteira')
  return { ok: true }
}
