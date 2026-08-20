import { criarClienteServidor } from '@/lib/supabase/server'
import { ehCorValida, type Etiqueta } from '@/lib/etiquetas'

/**
 * Etiquetas do usuário logado, em ordem alfabética.
 *
 * Devolve lista vazia — em vez de estourar — quando a tabela ainda não existe
 * no banco, para que o app continue de pé antes de a migration 0002 rodar.
 */
export async function listarEtiquetas(): Promise<Etiqueta[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('etiquetas')
    .select('id, nome, cor')
    .order('nome')

  if (error || !data) return []

  return data
    .filter((linha) => ehCorValida(linha.cor))
    .map((linha) => ({
      id: linha.id as string,
      nome: linha.nome as string,
      cor: linha.cor as Etiqueta['cor'],
    }))
}
