import { mesmoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type MensagemDaConversa = {
  id: string
  direcao: 'saida' | 'entrada'
  status: string
  texto: string
  quando: string
  erro: string | null
  nome: string | null
}

/** A thread lê de cima para baixo; a lista de conversas é que inverte. */
export function ordenarCronologico<T extends { quando: string }>(linhas: T[]): T[] {
  return [...linhas].sort((x, y) => x.quando.localeCompare(y.quando))
}

/** Teto por conversa: acima disto a tela vira rolagem infinita sem utilidade. */
const LIMITE_THREAD = 200

/**
 * Teto de linhas recentes varridas para achar as de uma conversa.
 *
 * Exportado porque o envio (app/(app)/mensagens/actions.ts) varre a mesma
 * tabela para descobrir por qual conexão responder: se ele varresse menos que
 * a leitura, existiria conversa que a tela renderiza mas o botão Enviar
 * recusa — e a pessoa veria um erro pedindo justamente o que ela acabou de
 * fazer. Um valor só para os dois lados torna esse descompasso impossível.
 */
export const LIMITE_VARREDURA_CONVERSA = 1000

/**
 * Histórico de uma conversa só.
 *
 * O filtro por número acontece em memória, não no Postgres: as linhas da
 * mesma pessoa podem estar gravadas com e sem o nono dígito, e `eq('numero')`
 * traria metade da conversa. O recorte de dono fica com a RLS.
 */
export async function listarMensagensDaConversa(
  numero: string,
): Promise<MensagemDaConversa[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('mensagens')
    .select('id, numero, nome, direcao, status, texto, erro, criado_em')
    .order('criado_em', { ascending: false })
    .limit(LIMITE_VARREDURA_CONVERSA)

  if (error || !data) return []

  const desta = data.filter((linha) => mesmoNumero(String(linha.numero), numero))

  return ordenarCronologico(
    desta.slice(0, LIMITE_THREAD).map((linha) => ({
      id: String(linha.id),
      direcao: String(linha.direcao) as MensagemDaConversa['direcao'],
      status: String(linha.status),
      texto: String(linha.texto),
      quando: String(linha.criado_em),
      erro: linha.erro ? String(linha.erro) : null,
      // pushName do WhatsApp (migração 0007); a Task 3 usa para titular a
      // thread em vez do número cru.
      nome: linha.nome ? String(linha.nome) : null,
    })),
  )
}
