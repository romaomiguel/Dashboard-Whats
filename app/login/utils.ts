export function destinoSeguro(destino: string): string {
  // Rejeita caminhos que começam com //, /\, ou contêm esquema URL
  if (
    destino.startsWith('//') ||
    destino.startsWith('/\\') ||
    destino.includes('://')
  ) {
    return '/'
  }
  // Aceita apenas caminhos internos (começam com /)
  return destino.startsWith('/') ? destino : '/'
}
