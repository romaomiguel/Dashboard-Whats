import { TIPOS_NOTIFICACAO, type Notificacao } from '@/lib/notificacoes'
import { criarClienteServidor } from '@/lib/supabase/server'

/** Limite do painel: passar disso vira rolagem infinita sem utilidade. */
const LIMITE_PAINEL = 30

function ehTipo(valor: string): valor is Notificacao['tipo'] {
  return (TIPOS_NOTIFICACAO as readonly string[]).includes(valor)
}

/**
 * Notificações do usuário logado, das mais recentes.
 *
 * Ordena por atualizado_em, não por criado_em: conversa antiga que recebe
 * mensagem nova precisa subir ao topo do sino.
 *
 * Lista vazia quando a tabela ainda não existe, para o app continuar de pé
 * antes de a migration 0012 rodar.
 */
export async function listarNotificacoes(): Promise<Notificacao[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, tipo, titulo, corpo, destino, lida, atualizado_em')
    .order('atualizado_em', { ascending: false })
    .limit(LIMITE_PAINEL)

  if (error || !data) return []

  return data
    .filter((linha) => ehTipo(String(linha.tipo)))
    .map((linha) => ({
      id: String(linha.id),
      tipo: String(linha.tipo) as Notificacao['tipo'],
      titulo: String(linha.titulo),
      corpo: linha.corpo ? String(linha.corpo) : null,
      destino: linha.destino ? String(linha.destino) : null,
      lida: Boolean(linha.lida),
      quando: String(linha.atualizado_em),
    }))
}
