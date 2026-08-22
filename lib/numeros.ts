/**
 * Chave para reconhecer que dois números são a mesma pessoa.
 *
 * No Brasil o celular ganhou um nono dígito, mas o identificador que o
 * WhatsApp devolve costuma vir sem ele. Na prática isso apareceu assim: o
 * disparo saiu para 5565984627628 e a resposta chegou de 556584627628. Como o
 * agrupamento era pelo número cru, a resposta virava uma conversa nova e a
 * original ficava parada em "enviada".
 *
 * A forma canônica é a **sem** o nono dígito, que é a que o WhatsApp usa.
 * Serve só para comparar — o número mostrado na tela continua o que foi
 * cadastrado.
 */
export function chaveDoNumero(numero: string): string {
  const digitos = numero.replace(/\D/g, '')

  // 55 + DDD (2) + 9 + oito dígitos. O nono vem logo depois do DDD.
  const ehCelularBrasileiroComNove =
    digitos.length === 13 && digitos.startsWith('55') && digitos[4] === '9'

  if (ehCelularBrasileiroComNove) {
    return digitos.slice(0, 4) + digitos.slice(5)
  }

  return digitos
}

/** Verdadeiro quando os dois endereçam a mesma pessoa. */
export function mesmoNumero(a: string, b: string): boolean {
  return chaveDoNumero(a) === chaveDoNumero(b)
}

/**
 * As formas de escrever este número que uma busca por dígitos deve alcançar.
 *
 * A chave canônica sozinha não serve para busca parcial: ela só tira o nono
 * dígito de um número **completo** de 13 dígitos começando com 55. Quem
 * digita do jeito natural — `65984038479`, ou só `984038479` — nunca chega
 * aos 13 e por isso nunca casaria com uma conversa gravada sem o nono, que é
 * justamente a forma que o webhook do WhatsApp escreve.
 *
 * Devolver as duas grafias completas (com e sem o nono) resolve pelo outro
 * lado: qualquer pedaço que a pessoa digite é substring de uma delas.
 */
export function formasDoNumero(numero: string): string[] {
  const digitos = numero.replace(/\D/g, '')
  const canonica = chaveDoNumero(numero)
  const formas = new Set([digitos, canonica])

  // 55 + DDD (2) + oito dígitos. Só celular ganhou o nono: reinventá-lo num
  // fixo criaria um número que não existe e casaria com busca alheia — daí a
  // checagem do primeiro dígito do assinante, que em celular é 6 a 9.
  const ehCelularSemNove =
    canonica.length === 12 && canonica.startsWith('55') && /[6-9]/.test(canonica[4])

  if (ehCelularSemNove) {
    formas.add(canonica.slice(0, 4) + '9' + canonica.slice(4))
  }

  return [...formas].filter((f) => f !== '')
}
