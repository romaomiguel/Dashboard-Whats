'use server'

import { revalidatePath } from 'next/cache'
import { ehCorValida, LIMITE_NOME_ETIQUETA } from '@/lib/etiquetas'
import { PREFERENCIA_POR_TIPO, type TipoNotificacao } from '@/lib/notificacoes'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoPerfil = { erro?: string; ok?: boolean }
export type EstadoEtiqueta = { erro?: string; ok?: boolean }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function salvarPerfil(
  _estadoAnterior: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const nome = String(formData.get('nome') ?? '').trim()

  if (nome.length > 80) {
    return { erro: 'O nome deve ter no máximo 80 caracteres.' }
  }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // upsert, não update: uma conta criada antes do trigger de perfil não tem
  // linha em profiles, e ali o update passava sem gravar nada e sem erro.
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, nome }, { onConflict: 'id' })

  if (error) return { erro: 'Não foi possível salvar. Tente de novo.' }

  // O nome aparece na topbar, que vive no layout: revalidar só a rota atual
  // deixaria a topbar exibindo o nome antigo.
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function criarEtiqueta(
  _estadoAnterior: EstadoEtiqueta,
  formData: FormData,
): Promise<EstadoEtiqueta> {
  const nome = String(formData.get('nome') ?? '').trim()
  const cor = String(formData.get('cor') ?? 'cinza')

  if (!nome) return { erro: 'Dê um nome à etiqueta.' }
  if (nome.length > LIMITE_NOME_ETIQUETA) {
    return { erro: `O nome deve ter no máximo ${LIMITE_NOME_ETIQUETA} caracteres.` }
  }
  if (!ehCorValida(cor)) return { erro: 'Escolha uma cor da lista.' }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { error } = await supabase
    .from('etiquetas')
    .insert({ owner_id: user.id, nome, cor })

  if (error) {
    // 23505 é a unique (owner_id, nome): etiqueta repetida é erro do usuário,
    // não falha do sistema, e merece uma mensagem que explique.
    if (error.code === '23505') return { erro: `Você já tem a etiqueta "${nome}".` }
    return { erro: 'Não foi possível criar a etiqueta. Tente de novo.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function excluirEtiqueta(id: string): Promise<EstadoEtiqueta> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // A RLS já limita à própria linha; o filtro por owner_id é a segunda tranca.
  const { error } = await supabase
    .from('etiquetas')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível excluir. Tente de novo.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export type EstadoPreferencia = { erro?: string; ok?: boolean }

/**
 * Liga ou desliga um tipo de notificação.
 *
 * O tipo vira nome de coluna, então a validação contra PREFERENCIA_POR_TIPO
 * não é formalidade: sem ela, uma string da tela viraria identificador SQL.
 * Server action é chamável por requisição HTTP direta, então o TypeScript do
 * lado do cliente não barra nada — quem chega aqui pode ser qualquer string.
 *
 * `hasOwn`, não `PREFERENCIA_POR_TIPO[tipo]` sozinho: nomes herdados de
 * Object.prototype como 'constructor' ou 'toString' devolvem valor truthy no
 * acesso por colchetes e passariam pela checagem de "existe".
 */
export async function salvarPreferencia(
  tipo: TipoNotificacao,
  ligado: boolean,
): Promise<EstadoPreferencia> {
  if (!Object.hasOwn(PREFERENCIA_POR_TIPO, tipo)) {
    return { erro: 'Tipo de notificação desconhecido.' }
  }
  const coluna = PREFERENCIA_POR_TIPO[tipo]

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { error } = await supabase
    .from('profiles')
    .update({ [coluna]: ligado })
    .eq('id', user.id)

  if (error) return { erro: 'Não foi possível salvar a preferência.' }

  revalidatePath('/configuracoes')
  return { ok: true }
}
