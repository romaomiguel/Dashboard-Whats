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
