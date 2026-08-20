import { ehTipoValido, type TipoMidia } from '@/lib/midias'
import { criarClienteServidor } from '@/lib/supabase/server'

export type MidiaSalva = {
  id: string
  nome: string
  tipo: TipoMidia
  tamanho: number
  legenda: string | null
  criadoEm: string
}

/**
 * Mídias do usuário logado, da mais nova para a mais antiga.
 *
 * Lista vazia quando a tabela ainda não existe, para o app continuar de pé
 * antes de a migration 0004 rodar.
 */
export async function listarMidias(): Promise<MidiaSalva[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('midias')
    .select('id, nome, tipo, tamanho, legenda, criado_em')
    .order('criado_em', { ascending: false })

  if (error || !data) return []

  return data
    .filter((linha) => ehTipoValido(String(linha.tipo)))
    .map((linha) => ({
      id: String(linha.id),
      nome: String(linha.nome),
      tipo: String(linha.tipo) as TipoMidia,
      tamanho: Number(linha.tamanho),
      legenda: linha.legenda ? String(linha.legenda) : null,
      criadoEm: String(linha.criado_em),
    }))
}
