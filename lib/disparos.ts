/**
 * Tipos e rótulos dos disparos — sem nada de servidor, para componente de
 * cliente poder importar sem arrastar o Supabase junto.
 */
export const STATUS_DISPARO = [
  'agendado',
  'enviando',
  'concluido',
  'cancelado',
] as const

export type StatusDisparo = (typeof STATUS_DISPARO)[number]

export const LIMITE_NOME_DISPARO = 60
export const LIMITE_MENSAGEM = 4096

/** Quanto "Agora" adia o envio, para dar tempo de cancelar um engano. */
export const MINUTOS_AGORA = 1

export type Disparo = {
  id: string
  nome: string
  mensagem: string
  conexao: string | null
  publico: string
  agendadoPara: string
  status: StatusDisparo
  total: number
  enviados: number
  falhas: number
}

export const ROTULO_DISPARO: Record<StatusDisparo, string> = {
  agendado: 'Agendado',
  enviando: 'Enviando',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const ESTILO_DISPARO: Record<StatusDisparo, string> = {
  enviando: 'bg-primary/15 text-primary',
  agendado: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  concluido: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  cancelado: 'bg-muted text-muted-foreground',
}

export function ehStatusDisparo(valor: string): valor is StatusDisparo {
  return (STATUS_DISPARO as readonly string[]).includes(valor)
}

/**
 * Número no formato que a Evolution espera: só dígitos, com código do país.
 *
 * Os contatos são gravados como a pessoa digitou ("+55 11 91234-5678"), então
 * a normalização acontece na hora do envio, não no cadastro.
 */
export function numeroParaWhatsApp(numero: string): string | null {
  const digitos = numero.replace(/\D/g, '')
  if (digitos.length < 10) return null

  // O '+' é a declaração de que o código do país já está ali. Sem ele, um
  // número americano de 11 dígitos viraria brasileiro por engano.
  if (numero.trim().startsWith('+')) return digitos

  // Sem '+', 10 ou 11 dígitos é telefone brasileiro escrito sem o país:
  // 10 para fixo, 11 para celular.
  if (digitos.length <= 11) return `55${digitos}`
  return digitos
}

/** Porcentagem entregue, multiplicando antes de dividir. */
export function progresso(enviados: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((enviados * 100) / total)
}
