'use server'

import { revalidatePath } from 'next/cache'
import { LIMITE_ETAPAS, nomeDeEtapaValido, proximaOrdem } from '@/lib/esteira'
import { PAPEIS, type Papel } from '@/lib/funil'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoEsteira = { erro?: string; ok?: boolean; id?: string }

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

  const { data: criada, error } = await supabase
    .from('etapas')
    .insert({
      owner_id: user.id,
      nome: limpo,
      ordem: proximaOrdem(ordens),
    })
    // O id volta porque montar o funil padrão precisa marcar o papel logo
    // em seguida; sem ele, a tela teria de reler tudo para achar qual etapa
    // acabou de nascer.
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return { erro: 'Você já tem uma etapa com esse nome.' }
    return { erro: 'Não foi possível criar a etapa.' }
  }

  revalidatePath('/esteira')
  return { ok: true, id: criada ? String(criada.id) : undefined }
}

/**
 * Move a conversa de etapa e registra a passagem.
 *
 * `null` não é destino válido: sem a coluna "Sem etapa", tirar do funil
 * deixou de ser uma operação da tela.
 */
export async function moverNoFunil(
  funilId: string,
  etapaId: string,
): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: linha } = await supabase
    .from('funil')
    .select('id, etapa_id, etapas(nome)')
    .eq('id', funilId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!linha) return { erro: 'Conversa não encontrada.' }

  const { data: destino } = await supabase
    .from('etapas')
    .select('nome')
    .eq('id', etapaId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!destino) return { erro: 'Etapa não encontrada.' }

  const { error } = await supabase
    .from('funil')
    .update({ etapa_id: etapaId, atualizado_em: new Date().toISOString() })
    .eq('id', funilId)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível mover a conversa.' }

  // Falha aqui não desfaz a movimentação: a conversa já está na etapa
  // certa, e perder uma linha de histórico é menos grave que devolver erro
  // para uma ação que aconteceu.
  const { error: erroHistorico } = await supabase.from('funil_historico').insert({
    owner_id: user.id,
    funil_id: funilId,
    de: (linha as { etapas?: { nome?: string } }).etapas?.nome ?? null,
    para: String(destino.nome),
    automatico: false,
  })

  if (erroHistorico) {
    console.error('[esteira] histórico não gravou:', erroHistorico.code, erroHistorico.message)
  }

  revalidatePath('/esteira')
  return { ok: true }
}

/**
 * Marca qual etapa recebe conversa nova e qual recebe quem respondeu.
 *
 * É o que permite renomear as etapas sem quebrar a automação: ela procura
 * o papel, nunca o nome.
 */
export async function definirPapel(
  etapaId: string,
  papel: Papel | null,
): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  if (papel !== null && !PAPEIS.includes(papel)) {
    return { erro: 'Papel inválido.' }
  }

  const { error } = await supabase
    .from('etapas')
    .update({ papel })
    .eq('id', etapaId)
    .eq('owner_id', user.id)

  if (error) {
    if (error.code === '23505') {
      return { erro: 'Esse papel já pertence a outra etapa. Tire dela primeiro.' }
    }
    return { erro: 'Não foi possível definir o papel da etapa.' }
  }

  revalidatePath('/esteira')
  return { ok: true }
}

export async function removerEtapa(id: string): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // O 'on delete set null' da 0015 deixa a linha do funil órfã; a próxima
  // mensagem daquela conversa devolve ela para a entrada.
  const { error } = await supabase
    .from('etapas')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível remover a etapa.' }

  revalidatePath('/esteira')
  return { ok: true }
}
