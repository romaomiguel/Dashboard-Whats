/** Funil inicial de quem vende por WhatsApp; o usuário renomeia depois. */
export const ETAPAS_PADRAO = [
  'Novo',
  'Em conversa',
  'Negociando',
  'Fechado',
] as const

/** Espelha o check de `etapas.nome` na 0014. */
export const LIMITE_NOME_ETAPA = 24

/** Acima disto o quadro vira rolagem horizontal sem utilidade. */
export const LIMITE_ETAPAS = 12

export function nomeDeEtapaValido(nome: string): boolean {
  const limpo = nome.trim()
  return limpo.length >= 1 && limpo.length <= LIMITE_NOME_ETAPA
}

/**
 * Ordem da próxima etapa criada.
 *
 * Usa o maior e não a contagem: remover uma etapa do meio deixa buracos, e
 * contar produziria um número já ocupado, empatando duas colunas.
 */
export function proximaOrdem(ordens: number[]): number {
  if (ordens.length === 0) return 0
  return Math.max(...ordens) + 1
}
