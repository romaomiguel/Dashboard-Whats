import { estadoDaConversa, type EstadoConversa } from '@/lib/conversas'
import { chaveDoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type Conversa = {
  numero: string
  nome: string
  previa: string
  quando: string
  direcao: 'saida' | 'entrada'
  estado: EstadoConversa
  naoLidas: number
}

type Acumulado = {
  conversa: Conversa
  temEntrada: boolean
  ultimoStatus: string
}

/**
 * Uma linha por contato, com a última mensagem trocada.
 *
 * O agrupamento acontece aqui e não no Postgres porque o volume da entrega
 * atual cabe na memória; quando não couber, isto vira uma view.
 */
export async function listarConversas(): Promise<Conversa[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('mensagens')
    .select('numero, nome, direcao, status, texto, criado_em')
    .order('criado_em', { ascending: false })
    .limit(500)

  if (error || !data) return []

  const porContato = new Map<string, Acumulado>()

  for (const linha of data) {
    const numero = String(linha.numero)
    const direcao = String(linha.direcao) as Conversa['direcao']
    const status = String(linha.status)

    // Agrupa pela forma canônica: o WhatsApp devolve o número brasileiro sem
    // o nono dígito, então o cru separaria a resposta da mensagem enviada.
    const chave = chaveDoNumero(numero)
    const existente = porContato.get(chave)

    if (!existente) {
      porContato.set(chave, {
        // A lista vem da mais nova para a mais antiga, então esta é a última.
        conversa: {
          numero,
          nome: linha.nome ? String(linha.nome) : numero,
          previa: String(linha.texto),
          quando: String(linha.criado_em),
          direcao,
          estado: 'enviada',
          naoLidas: direcao === 'entrada' ? 1 : 0,
        },
        temEntrada: direcao === 'entrada',
        ultimoStatus: status,
      })
      continue
    }

    if (direcao === 'entrada') {
      existente.temEntrada = true
      existente.conversa.naoLidas += 1
    }

    // Quem se identificou fica: o pushName do WhatsApp costuma vir só na
    // mensagem recebida, e o disparo grava o nome do cadastro.
    if (existente.conversa.nome === existente.conversa.numero && linha.nome) {
      existente.conversa.nome = String(linha.nome)
    }
  }

  return [...porContato.values()].map(({ conversa, temEntrada, ultimoStatus }) => ({
    ...conversa,
    estado: estadoDaConversa({
      ultimaDirecao: conversa.direcao,
      ultimoStatus,
      temEntrada,
    }),
  }))
}
