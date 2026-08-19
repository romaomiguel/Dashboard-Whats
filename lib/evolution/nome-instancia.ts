import { EvolutionError } from './errors'

const FORMATO_NOME = /^inst_[0-9a-f]{8}$/

/**
 * Valida e retorna o nome de instância.
 * Lança EvolutionError se o formato não bater.
 * Allowlist rigorosa previne path traversal via ponto normalizado em URLs.
 */
export function validarNomeInstancia(nome: string): string {
  if (!FORMATO_NOME.test(nome)) {
    throw new EvolutionError(
      'configuracao',
      `Nome de instância inválido: ${JSON.stringify(nome)}`,
    )
  }
  return nome
}
