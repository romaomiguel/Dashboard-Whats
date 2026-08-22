/** O que a automação procura numa etapa, em vez do nome dela. */
export type Papel = 'entrada' | 'respondeu'

export const PAPEIS: readonly Papel[] = ['entrada', 'respondeu'] as const

export type EntradaDaDecisao = {
  existe: boolean
  etapaAtualId: string | null
  direcao: 'entrada' | 'saida'
  etapaEntradaId: string | null
  etapaRespondeuId: string | null
}

export type Movimento =
  | { tipo: 'nada' }
  | { tipo: 'alocar'; etapaId: string }
  | { tipo: 'promover'; etapaId: string }

/**
 * O que fazer com a conversa quando uma mensagem é gravada.
 *
 * Separado da gravação de propósito: são sete regras que se contradizem
 * facilmente, e testá-las contra um banco de mentira esconderia justamente
 * a que importa — a de não mexer em quem já passou da entrada.
 */
export function decidirMovimento({
  existe,
  etapaAtualId,
  direcao,
  etapaEntradaId,
  etapaRespondeuId,
}: EntradaDaDecisao): Movimento {
  // Conversa nova, ou linha que ficou sem etapa porque a etapa foi apagada:
  // as duas precisam de casa, e a casa é a entrada.
  if (!existe || etapaAtualId === null) {
    return etapaEntradaId ? { tipo: 'alocar', etapaId: etapaEntradaId } : { tipo: 'nada' }
  }

  // Promover é de mão única: só sai da entrada, e só porque o contato
  // respondeu. Daí em diante quem move é o usuário.
  const respondeu = direcao === 'entrada'
  if (respondeu && etapaAtualId === etapaEntradaId && etapaRespondeuId) {
    return { tipo: 'promover', etapaId: etapaRespondeuId }
  }

  return { tipo: 'nada' }
}
