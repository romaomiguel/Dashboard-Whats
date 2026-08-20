/**
 * Leitor de CSV suficiente para a importação de contatos: separador vírgula
 * ou ponto e vírgula, aspas duplas com escape por aspas dobradas, quebra de
 * linha dentro do campo entre aspas.
 *
 * Não é um parser de CSV completo — é o recorte que a planilha de contatos
 * exige, escrito para ser testável sem depender de biblioteca.
 */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let entreAspas = false

  // Detecta o separador pela primeira linha: planilha em português costuma
  // sair com ponto e vírgula.
  const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
  const separador =
    primeira.split(';').length > primeira.split(',').length ? ';' : ','

  const limpo = texto.replace(/^\uFEFF/, '') // BOM do Excel

  for (let i = 0; i < limpo.length; i += 1) {
    const c = limpo[i]

    if (entreAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"'
          i += 1
        } else {
          entreAspas = false
        }
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') {
      entreAspas = true
    } else if (c === separador) {
      linha.push(campo.trim())
      campo = ''
    } else if (c === '\n') {
      linha.push(campo.trim())
      campo = ''
      linhas.push(linha)
      linha = []
    } else if (c !== '\r') {
      campo += c
    }
  }

  linha.push(campo.trim())
  linhas.push(linha)

  // Descarta linhas totalmente vazias (a última quebra do arquivo gera uma).
  return linhas.filter((l) => l.some((celula) => celula !== ''))
}

const CABECALHOS = ['nome', 'numero', 'número', 'telefone', 'etiqueta', 'tag']

/** Descarta a primeira linha quando ela é claramente cabeçalho. */
export function semCabecalho(linhas: string[][]): string[][] {
  const primeira = linhas[0]
  if (!primeira) return linhas
  const ehCabecalho = primeira.some((celula) =>
    CABECALHOS.includes(celula.toLowerCase()),
  )
  return ehCabecalho ? linhas.slice(1) : linhas
}
