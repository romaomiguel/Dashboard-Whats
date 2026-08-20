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
