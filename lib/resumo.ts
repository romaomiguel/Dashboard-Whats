/**
 * Agregações da Home, sem tocar no banco — para poderem ser testadas.
 *
 * O fuso é fixo em São Paulo pelo mesmo motivo de lib/datas.ts: servidor em
 * UTC e navegador do usuário precisam concordar sobre onde "hoje" começa.
 */
const FUSO = 'America/Sao_Paulo'

/** O Brasil não usa mais horário de verão desde 2019, então -3 é estável. */
const OFFSET_HORAS = 3

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const UM_DIA_MS = 86_400_000

export type LinhaMensagem = {
  direcao: string
  status: string
  numero: string
  criado_em: string
}

export type DiaDaSemana = { dia: string; enviadas: number; recebidas: number }

export type EtapaFunil = { etapa: string; valor: number; fill: string }

/** Instante em que o dia começou em São Paulo, opcionalmente dias atrás. */
export function inicioDoDia(agora: Date, diasAtras = 0): Date {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(agora)
    .split('-')
    .map(Number)

  return new Date(
    Date.UTC(ano, mes - 1, dia, OFFSET_HORAS) - diasAtras * UM_DIA_MS,
  )
}

export function rotuloDoDia(momento: Date): string {
  return DIAS[
    new Date(momento.getTime() - OFFSET_HORAS * 3_600_000).getUTCDay()
  ]
}

export function porcentagem(parte: number, todo: number): number {
  if (todo <= 0) return 0
  return Math.round((parte * 100) / todo)
}

/** Sete cubas, do dia mais antigo até hoje. */
export function volumeDaSemana(
  linhas: LinhaMensagem[],
  agora: Date,
): DiaDaSemana[] {
  const primeiroDia = inicioDoDia(agora, 6).getTime()

  const semana: DiaDaSemana[] = Array.from({ length: 7 }, (_, i) => ({
    dia: rotuloDoDia(new Date(primeiroDia + i * UM_DIA_MS)),
    enviadas: 0,
    recebidas: 0,
  }))

  for (const linha of linhas) {
    const quando = new Date(linha.criado_em).getTime()
    const indice = Math.floor((quando - primeiroDia) / UM_DIA_MS)
    if (indice < 0 || indice > 6) continue

    if (linha.direcao === 'saida') semana[indice].enviadas += 1
    else semana[indice].recebidas += 1
  }

  return semana
}

/**
 * Funil de desempenho dos envios.
 *
 * "Entregues" cai para o que a API aceitou enquanto nenhum recibo chegou —
 * uma instância sem webhook configurado nunca receberia confirmação, e um
 * funil zerado passaria a impressão errada de que nada saiu.
 */
export function funilDeEntrega(linhas: LinhaMensagem[]): EtapaFunil[] {
  const saidas = linhas.filter((l) => l.direcao === 'saida')
  const tentadas = saidas.length

  const aceitas = saidas.filter((l) => l.status !== 'falhou').length
  const comRecibo = saidas.filter((l) =>
    ['entregue', 'lida'].includes(l.status),
  ).length
  const lidas = saidas.filter((l) => l.status === 'lida').length

  const alcancados = new Set(saidas.map((l) => l.numero))
  const responderam = new Set(
    linhas.filter((l) => l.direcao === 'entrada').map((l) => l.numero),
  )
  const respostas = [...responderam].filter((n) => alcancados.has(n)).length

  return [
    {
      etapa: 'Entregues',
      valor: porcentagem(comRecibo > 0 ? comRecibo : aceitas, tentadas),
      fill: 'var(--color-entregues)',
    },
    {
      etapa: 'Lidas',
      valor: porcentagem(lidas, tentadas),
      fill: 'var(--color-lidas)',
    },
    {
      etapa: 'Respondidas',
      valor: porcentagem(respostas, alcancados.size),
      fill: 'var(--color-respondidas)',
    },
  ]
}
