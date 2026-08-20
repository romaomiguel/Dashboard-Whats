import { describe, expect, it } from 'vitest'
import { lerCsv, semCabecalho } from '@/lib/csv'

describe('lerCsv', () => {
  it('lê linhas e colunas separadas por vírgula', () => {
    expect(lerCsv('Ana,+55 11 90000-0000,VIP\nBruno,+55 11 91111-1111,Lead')).toEqual([
      ['Ana', '+55 11 90000-0000', 'VIP'],
      ['Bruno', '+55 11 91111-1111', 'Lead'],
    ])
  })

  it('aceita ponto e vírgula, como sai da planilha em português', () => {
    expect(lerCsv('Ana;+55 11 90000-0000;VIP')).toEqual([
      ['Ana', '+55 11 90000-0000', 'VIP'],
    ])
  })

  it('respeita vírgula dentro de aspas', () => {
    expect(lerCsv('"Silva, Ana",+55 11 90000-0000')).toEqual([
      ['Silva, Ana', '+55 11 90000-0000'],
    ])
  })

  it('desdobra aspas duplicadas', () => {
    expect(lerCsv('"Ana ""A"" Silva",123')).toEqual([['Ana "A" Silva', '123']])
  })

  it('ignora o BOM que o Excel escreve', () => {
    expect(lerCsv('\uFEFFAna,123')).toEqual([['Ana', '123']])
  })

  it('descarta linhas em branco, inclusive a última do arquivo', () => {
    expect(lerCsv('Ana,123\n\nBruno,456\n')).toEqual([
      ['Ana', '123'],
      ['Bruno', '456'],
    ])
  })

  it('aceita quebra de linha dentro de campo entre aspas', () => {
    expect(lerCsv('"Ana\nMaria",123')).toEqual([['Ana\nMaria', '123']])
  })
})

describe('semCabecalho', () => {
  it('remove a primeira linha quando ela é cabeçalho', () => {
    expect(
      semCabecalho([
        ['Nome', 'Número', 'Etiqueta'],
        ['Ana', '123', 'VIP'],
      ]),
    ).toEqual([['Ana', '123', 'VIP']])
  })

  it('mantém tudo quando não há cabeçalho', () => {
    expect(semCabecalho([['Ana', '123']])).toEqual([['Ana', '123']])
  })
})
