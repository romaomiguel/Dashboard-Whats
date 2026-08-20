import {
  funilDeEntrega,
  inicioDoDia,
  volumeDaSemana,
  type DiaDaSemana,
  type EtapaFunil,
  type LinhaMensagem,
} from '@/lib/resumo'
import { criarClienteServidor } from '@/lib/supabase/server'

export type Resumo = {
  contatos: number
  mensagensHoje: number
  naoLidas: number
  disparosHoje: number
  conexoesAtivas: number
  conexoesTotal: number
  semana: DiaDaSemana[]
  funil: EtapaFunil[]
  /** Falso quando não há nada gravado: a Home cai nos dados de exemplo. */
  temDados: boolean
}

export const RESUMO_VAZIO: Resumo = {
  contatos: 0,
  mensagensHoje: 0,
  naoLidas: 0,
  disparosHoje: 0,
  conexoesAtivas: 0,
  conexoesTotal: 0,
  semana: [],
  funil: [],
  temDados: false,
}

/**
 * Números da Home, todos vindos do banco.
 *
 * As contas ficam em lib/resumo.ts, sem acesso a dados, para poderem ser
 * testadas. Aqui só se busca e se junta.
 */
export async function carregarResumo(): Promise<Resumo> {
  const supabase = await criarClienteServidor()
  const agora = new Date()

  const [contatos, conexoes, mensagens] = await Promise.all([
    supabase.from('contatos').select('id', { count: 'exact', head: true }),
    supabase.from('instances').select('status'),
    supabase
      .from('mensagens')
      .select('direcao, status, numero, criado_em')
      .gte('criado_em', inicioDoDia(agora, 6).toISOString())
      .limit(5000),
  ])

  const linhas: LinhaMensagem[] = (mensagens.data ?? []).map((m) => ({
    direcao: String(m.direcao),
    status: String(m.status),
    numero: String(m.numero),
    criado_em: String(m.criado_em),
  }))

  const conexoesLista = conexoes.data ?? []
  const inicioHoje = inicioDoDia(agora).getTime()
  const deHoje = linhas.filter(
    (m) => new Date(m.criado_em).getTime() >= inicioHoje,
  )

  const totalContatos = contatos.count ?? 0

  return {
    contatos: totalContatos,
    mensagensHoje: deHoje.length,
    naoLidas: deHoje.filter((m) => m.direcao === 'entrada').length,
    disparosHoje: deHoje.filter((m) => m.direcao === 'saida').length,
    conexoesAtivas: conexoesLista.filter((c) => String(c.status) === 'conectada')
      .length,
    conexoesTotal: conexoesLista.length,
    semana: volumeDaSemana(linhas, agora),
    funil: funilDeEntrega(linhas),
    temDados:
      totalContatos > 0 || linhas.length > 0 || conexoesLista.length > 0,
  }
}
