/**
 * Endereço público do app, para montar a URL que a Evolution vai chamar.
 *
 * Antes isso saía só de `NEXT_PUBLIC_APP_URL`, e foi um erro: variável com
 * prefixo NEXT_PUBLIC_ é **substituída na compilação**, não lida em tempo de
 * execução. Faltando no build, o valor congela como vazio, e acrescentá-la
 * depois no painel não muda nada até haver um build novo — foi o que gravou um
 * webhook sem domínio, que a Evolution nunca conseguiu chamar.
 *
 * A ordem abaixo prefere o que existe em tempo de execução. Na Vercel, as duas
 * do meio vêm sozinhas, sem ninguém precisar configurar nada.
 */
export type AmbienteUrl = Record<string, string | undefined>

/** Acrescenta https:// ao que vem só como domínio, e tira barra do fim. */
function normalizar(valor: string): string {
  const limpo = valor.trim().replace(/\/+$/, '')
  if (!limpo) return ''
  return /^https?:\/\//.test(limpo) ? limpo : `https://${limpo}`
}

/**
 * Primeiro endereço utilizável, ou null.
 *
 * `VERCEL_URL` fica por último entre as automáticas porque aponta para o
 * deploy específico: serve de rede de segurança, mas muda a cada publicação, e
 * um webhook apontando para um deploy antigo pararia de responder.
 */
export function descobrirUrlDoApp(ambiente: AmbienteUrl): string | null {
  const candidatos = [
    ambiente.APP_URL,
    ambiente.VERCEL_PROJECT_PRODUCTION_URL,
    ambiente.VERCEL_URL,
    ambiente.NEXT_PUBLIC_APP_URL,
  ]

  for (const bruto of candidatos) {
    if (!bruto) continue
    const url = normalizar(String(bruto))
    if (url) return url
  }

  return null
}

/** Faixas IPv4 que não se alcançam pela internet pública. */
function ehIpPrivado(host: string): boolean {
  const partes = host.split('.').map(Number)
  if (partes.length !== 4 || partes.some((n) => !Number.isInteger(n))) return false

  const [a, b] = partes
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  // 172.16 a 172.31 — e não "172." inteiro, que pegaria endereço público.
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

/**
 * Se a Evolution consegue alcançar este endereço.
 *
 * Quem chama o webhook é ela, de outra máquina — não o navegador do usuário.
 * Registrar `http://localhost:3000` grava um endereço que, do contêiner dela,
 * aponta para ela mesma: o envio segue funcionando (app → Evolution) e o
 * recebimento nunca acontece, sem erro em lugar nenhum. Falha invisível, e é
 * por isso que a criação de conexão passa a recusar antes de gravar.
 */
export function ehEnderecoAlcancavel(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }

  if (!host) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  // IPv6 chega entre colchetes; ::1 é o loopback.
  if (host === '[::1]' || host === '::1') return false
  if (host.endsWith('.local')) return false

  return !ehIpPrivado(host)
}
