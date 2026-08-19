export function destinoSeguro(destino: string): string {
  // Deve ser uma string não-vazia
  if (!destino) return '/'

  // Deve começar com / (evita caminhos relativos)
  if (!destino.startsWith('/')) return '/'

  try {
    const base = 'http://localhost'
    const url = new URL(destino, base)
    // Se o destino escapou para outra origem, descarta.
    if (url.origin !== base) return '/'
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
