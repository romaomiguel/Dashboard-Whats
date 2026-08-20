import { criarClienteServidor } from '@/lib/supabase/server'

export const STATUS_CONEXAO = [
  'criada',
  'conectando',
  'conectada',
  'desconectada',
] as const

export type StatusConexao = (typeof STATUS_CONEXAO)[number]

export type Conexao = {
  id: string
  nomeEvolution: string
  numero: string | null
  status: StatusConexao
  atualizadoEm: string
}

function ehStatus(valor: string): valor is StatusConexao {
  return (STATUS_CONEXAO as readonly string[]).includes(valor)
}

/**
 * A instância do usuário logado, ou null.
 *
 * É uma por usuário — o unique (owner_id) da migration 0001 garante isso —,
 * então `maybeSingle` basta.
 */
export async function buscarConexao(): Promise<Conexao | null> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('instances')
    .select('id, evolution_name, numero, status, atualizado_em')
    .maybeSingle()

  if (error || !data) return null

  const status = String(data.status)

  return {
    id: String(data.id),
    nomeEvolution: String(data.evolution_name),
    numero: data.numero ? String(data.numero) : null,
    status: ehStatus(status) ? status : 'criada',
    atualizadoEm: String(data.atualizado_em),
  }
}
