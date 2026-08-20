/** Duas primeiras iniciais de um nome, para o fallback do avatar. */
export function iniciais(nome: string) {
  return nome
    .split(' ')
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
