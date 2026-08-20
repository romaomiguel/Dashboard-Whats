import { usuarioLogado } from '@/lib/consultas/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'

export type Preferencias = {
  notificar_mensagem: boolean
  notificar_disparo: boolean
  notificar_conexao: boolean
}

/** Padrão de quem ainda não mexeu, e de antes da migration 0012. */
const TUDO_LIGADO: Preferencias = {
  notificar_mensagem: true,
  notificar_disparo: true,
  notificar_conexao: true,
}

export async function buscarPreferencias(): Promise<Preferencias> {
  // usuarioLogado() está em cache(): o layout já resolveu o usuário nesta
  // mesma requisição, e buscar de novo com auth.getUser() gastaria uma ida
  // a mais ao Supabase (~300ms) por carregamento da tela.
  const user = await usuarioLogado()
  if (!user) return TUDO_LIGADO

  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('profiles')
    .select('notificar_mensagem, notificar_disparo, notificar_conexao')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return TUDO_LIGADO

  return {
    notificar_mensagem: data.notificar_mensagem !== false,
    notificar_disparo: data.notificar_disparo !== false,
    notificar_conexao: data.notificar_conexao !== false,
  }
}
