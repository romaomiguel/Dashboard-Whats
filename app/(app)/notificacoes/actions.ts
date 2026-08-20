'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoNotificacao = { erro?: string; ok?: boolean }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Marca uma notificação como lida. O filtro por dono é a segunda tranca. */
export async function marcarComoLida(id: string): Promise<EstadoNotificacao> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível marcar como lida.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Limpa o contador de uma vez. */
export async function marcarTodasComoLidas(): Promise<EstadoNotificacao> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // Filtrar por lida=false evita reescrever linha que já estava lida.
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('owner_id', user.id)
    .eq('lida', false)

  if (error) return { erro: 'Não foi possível marcar todas como lidas.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}
