import { describe, expect, it } from 'vitest'
import {
  caminhoNoBucket,
  ehTipoValido,
  formatarTamanho,
  tipoDoArquivo,
} from '@/lib/midias'

describe('tipoDoArquivo', () => {
  it('classifica pelos prefixos do MIME', () => {
    expect(tipoDoArquivo('image/png')).toBe('imagem')
    expect(tipoDoArquivo('video/mp4')).toBe('video')
    expect(tipoDoArquivo('audio/ogg')).toBe('audio')
  })

  it('o que não é mídia conhecida vira documento', () => {
    expect(tipoDoArquivo('application/pdf')).toBe('documento')
    expect(tipoDoArquivo('')).toBe('documento')
  })
})

describe('formatarTamanho', () => {
  it('escolhe a unidade conforme a grandeza', () => {
    expect(formatarTamanho(512)).toBe('512 B')
    expect(formatarTamanho(2048)).toBe('2 KB')
    expect(formatarTamanho(2_400_000)).toBe('2,3 MB')
  })
})

describe('caminhoNoBucket', () => {
  it('começa pela pasta do dono, que é o que a policy do storage compara', () => {
    expect(caminhoNoBucket('user-1', 'foto.png').startsWith('user-1/')).toBe(true)
  })

  it('tira acento e espaço do nome do arquivo', () => {
    const caminho = caminhoNoBucket('u', 'Promoção de Natal.png')
    expect(caminho).toContain('Promocao-de-Natal.png')
  })

  it('não deixa o nome escapar da pasta do dono', () => {
    const caminho = caminhoNoBucket('u', '../../outro/segredo.png')
    expect(caminho.startsWith('u/')).toBe(true)
    expect(caminho).not.toContain('..')
    expect(caminho.split('/')).toHaveLength(2)
  })

  it('dois envios do mesmo arquivo não colidem', () => {
    expect(caminhoNoBucket('u', 'a.png')).not.toBe(caminhoNoBucket('u', 'a.png'))
  })
})

describe('ehTipoValido', () => {
  it('aceita só os tipos do enum', () => {
    expect(ehTipoValido('imagem')).toBe(true)
    expect(ehTipoValido('planilha')).toBe(false)
  })
})
