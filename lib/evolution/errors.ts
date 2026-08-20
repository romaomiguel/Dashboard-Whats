export type TipoErroEvolution =
  | 'configuracao'
  | 'rede'
  | 'autenticacao'
  | 'instancia_inexistente'
  | 'nome_invalido'
  | 'servidor'
  | 'resposta_invalida'

export class EvolutionError extends Error {
  readonly kind: TipoErroEvolution
  readonly status?: number
  readonly corpo?: unknown

  constructor(
    kind: TipoErroEvolution,
    mensagem: string,
    status?: number,
    corpo?: unknown,
  ) {
    super(mensagem)
    this.name = 'EvolutionError'
    this.kind = kind
    this.status = status
    this.corpo = corpo
  }
}

/** Mensagem para exibir ao usuário — sem vazar detalhe de infraestrutura. */
export function mensagemAmigavel(erro: EvolutionError): string {
  switch (erro.kind) {
    case 'configuracao':
      return 'A integração com o WhatsApp não está configurada.'
    case 'rede':
      return 'Não foi possível falar com o servidor do WhatsApp. Ele pode estar iniciando — tente novamente em um minuto.'
    case 'autenticacao':
      return 'Credencial do servidor de WhatsApp inválida.'
    case 'instancia_inexistente':
      return 'Esta conexão não existe mais no servidor.'
    case 'nome_invalido':
      return 'Esta conexão está com um nome inválido e não pode ser usada.'
    case 'servidor':
      return 'O servidor de WhatsApp respondeu com erro.'
    case 'resposta_invalida':
      return 'O servidor de WhatsApp devolveu uma resposta inesperada.'
  }
}
