'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoPerfil = { erro?: string; ok?: boolean }

export async function salvarPerfil(
  _estadoAnterior: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const nome = String(formData.get('nome') ?? '').trim()

  if (nome.length > 80) {
    return { erro: 'O nome deve ter no máximo 80 caracteres.' }
  }

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // A RLS já restringe a linha ao próprio usuário; o filtro por id é a
  // segunda tranca e evita depender só da policy.
  const { error } = await supabase
    .from('profiles')
    .update({ nome })
    .eq('id', user.id)

  if (error) return { erro: 'Não foi possível salvar. Tente de novo.' }

  revalidatePath('/configuracoes')
  return { ok: true }
}
