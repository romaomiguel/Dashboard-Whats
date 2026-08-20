import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/server'

/**
 * Usuário e perfil da requisição atual.
 *
 * Envolvidos em `cache()` porque layout e página renderizam na mesma
 * requisição e ambos precisam do usuário: sem isso, cada navegação gastava
 * uma ida ao Supabase a mais por chamada repetida — e cada ida custa uns
 * 300ms. `cache()` dedupa dentro da requisição, não entre requisições, então
 * nenhum dado vaza de um usuário para outro.
 */
export const usuarioLogado = cache(async () => {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const nomeDoPerfil = cache(async (): Promise<string> => {
  const usuario = await usuarioLogado()
  if (!usuario) return ''

  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', usuario.id)
    .maybeSingle()

  return data?.nome ?? ''
})
