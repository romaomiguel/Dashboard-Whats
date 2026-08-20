/**
 * Estado de uma conversa, do ponto de vista de quem opera o CRM.
 *
 * A distinção que importa é entre "a pessoa respondeu e está esperando" e "eu
 * já respondi": as duas terminam com mensagem trocada, mas só a primeira pede
 * ação.
 */
export const ESTADOS_CONVERSA = [
  'enviada',
  'respondeu',
  'respondida',
  'falhou',
] as const

export type EstadoConversa = (typeof ESTADOS_CONVERSA)[number]

export const ROTULO_CONVERSA: Record<EstadoConversa, string> = {
  enviada: 'Enviada',
  respondeu: 'Respondeu',
  respondida: 'Respondida',
  falhou: 'Falhou',
}

export const DESCRICAO_CONVERSA: Record<EstadoConversa, string> = {
  enviada: 'Saiu de você e ainda não teve resposta',
  respondeu: 'A pessoa respondeu e está esperando',
  respondida: 'Você já respondeu',
  falhou: 'O envio não chegou',
}

export const ESTILO_CONVERSA: Record<EstadoConversa, string> = {
  enviada: 'bg-muted text-muted-foreground',
  respondeu: 'bg-primary/15 text-primary',
  respondida: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  falhou: 'bg-destructive/15 text-destructive',
}

/**
 * Deduz o estado a partir da última mensagem e do histórico.
 *
 * `temEntrada` olha a conversa inteira: sem isso não daria para separar quem
 * nunca respondeu de quem respondeu e já foi respondido.
 */
export function estadoDaConversa({
  ultimaDirecao,
  ultimoStatus,
  temEntrada,
}: {
  ultimaDirecao: 'saida' | 'entrada'
  ultimoStatus: string
  temEntrada: boolean
}): EstadoConversa {
  if (ultimoStatus === 'falhou') return 'falhou'
  if (ultimaDirecao === 'entrada') return 'respondeu'
  return temEntrada ? 'respondida' : 'enviada'
}
