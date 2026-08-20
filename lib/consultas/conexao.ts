import { ehStatusConexao, type Conexao } from '@/lib/conexoes'
import { criarClienteServidor } from '@/lib/supabase/server'

/**
 * Conexões do usuário logado, da mais antiga para a mais nova.
 *
 * Lista vazia quando a tabela não existe ou a coluna `nome` ainda não foi
 * criada, para o app continuar de pé antes de a migration 0005 rodar.
 */
export async function listarConexoes(): Promise<Conexao[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('instances')
    .select('id, nome, evolution_name, numero, status, atualizado_em')
    .order('atualizado_em')

  if (error || !data) return []

  return data.map((linha) => {
    const status = String(linha.status)
    return {
      id: String(linha.id),
      nome: String(linha.nome ?? 'Conexão'),
      nomeEvolution: String(linha.evolution_name),
      numero: linha.numero ? String(linha.numero) : null,
      status: ehStatusConexao(status) ? status : 'criada',
      atualizadoEm: String(linha.atualizado_em),
    }
  })
}
