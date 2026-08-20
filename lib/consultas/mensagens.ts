import { criarClienteServidor } from '@/lib/supabase/server'

export type Conversa = {
  numero: string
  nome: string
  previa: string
  quando: string
  direcao: 'saida' | 'entrada'
  status: 'enviada' | 'falhou' | 'recebida'
  naoLidas: number
}

/**
 * Uma linha por número, com a última mensagem trocada.
 *
 * O agrupamento acontece aqui e não no Postgres porque o volume da Entrega 1
 * cabe na memória; quando não couber, isto vira uma view.
 */
export async function listarConversas(): Promise<Conversa[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('mensagens')
    .select('numero, nome, direcao, status, texto, criado_em')
    .order('criado_em', { ascending: false })
    .limit(500)

  if (error || !data) return []

  const porNumero = new Map<string, Conversa>()

  for (const linha of data) {
    const numero = String(linha.numero)
    const direcao = String(linha.direcao) as Conversa['direcao']

    const existente = porNumero.get(numero)

    if (!existente) {
      porNumero.set(numero, {
        numero,
        nome: linha.nome ? String(linha.nome) : numero,
        previa: String(linha.texto),
        quando: String(linha.criado_em),
        direcao,
        status: String(linha.status) as Conversa['status'],
        naoLidas: direcao === 'entrada' ? 1 : 0,
      })
      continue
    }

    // A lista já vem da mais nova para a mais antiga, então a primeira de cada
    // número é a última mensagem; o resto só soma as recebidas.
    if (direcao === 'entrada') existente.naoLidas += 1
    if (!existente.nome || existente.nome === numero) {
      if (linha.nome) existente.nome = String(linha.nome)
    }
  }

  return [...porNumero.values()]
}
