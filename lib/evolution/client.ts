import { EvolutionError } from './errors'

const TIMEOUT_MS = 20_000

/**
 * Timeout para a chamada que pode pegar o servidor dormindo.
 *
 * Medido: o plano free do Render leva ~77s para acordar, então os 20s
 * padrão abortavam sempre a primeira chamada depois de um período parado.
 */
export const TIMEOUT_ACORDAR_MS = 100_000

export type OpcoesChamada = {
  metodo?: 'GET' | 'POST' | 'DELETE'
  corpo?: unknown
  /** Sobrescreve o timeout padrão; use ao chamar um servidor que pode dormir. */
  timeoutMs?: number
}

function lerConfig() {
  const url = process.env.EVOLUTION_API_URL
  const apikey = process.env.EVOLUTION_API_KEY

  const faltando = [
    !url && 'EVOLUTION_API_URL',
    !apikey && 'EVOLUTION_API_KEY',
  ].filter(Boolean) as string[]

  if (faltando.length > 0) {
    // Só os nomes das chaves presentes, nunca os valores: o suficiente para
    // distinguir "variável não chegou ao deploy" de "nome digitado errado".
    const presentes = Object.keys(process.env)
      .filter((chave) => chave.startsWith('EVOLUTION'))
      .join(', ')

    console.error(
      `[evolution] faltando: ${faltando.join(', ')}. Chaves EVOLUTION vistas pelo processo: ${presentes || 'nenhuma'}`,
    )

    throw new EvolutionError('configuracao', faltando.join(' e '))
  }

  return { url: url!.replace(/\/+$/, ''), apikey: apikey! }
}

export async function chamar<T>(
  caminho: string,
  opcoes: OpcoesChamada = {},
): Promise<T> {
  const { url, apikey } = lerConfig()
  const metodo = opcoes.metodo ?? 'GET'

  const controlador = new AbortController()
  const timer = setTimeout(
    () => controlador.abort(),
    opcoes.timeoutMs ?? TIMEOUT_MS,
  )

  let resposta: Response
  try {
    resposta = await fetch(`${url}${caminho}`, {
      method: metodo,
      headers: {
        apikey,
        ...(opcoes.corpo !== undefined
          ? { 'content-type': 'application/json' }
          : {}),
      },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      signal: controlador.signal,
      cache: 'no-store',
    })
  } catch (causa) {
    throw new EvolutionError(
      'rede',
      `Evolution API inacessível em ${url}${caminho}`,
      undefined,
      causa,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    if (resposta.status === 401 || resposta.status === 403) {
      throw new EvolutionError('autenticacao', 'apikey rejeitada', resposta.status, corpo)
    }
    if (resposta.status === 404) {
      throw new EvolutionError(
        'instancia_inexistente',
        `Não encontrado: ${caminho}`,
        404,
        corpo,
      )
    }
    throw new EvolutionError(
      'servidor',
      `Evolution respondeu ${resposta.status}`,
      resposta.status,
      corpo,
    )
  }

  try {
    return (await resposta.json()) as T
  } catch (causa) {
    throw new EvolutionError(
      'resposta_invalida',
      'Resposta não é JSON válido',
      resposta.status,
      causa,
    )
  }
}
