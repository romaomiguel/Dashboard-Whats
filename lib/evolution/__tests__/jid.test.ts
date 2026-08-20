import { describe, expect, it } from 'vitest'
import { ehConversaDeContato, numeroDoContato } from '@/lib/evolution/jid'

describe('numeroDoContato', () => {
  it('lê o telefone do formato antigo', () => {
    expect(numeroDoContato({ remoteJid: '556584635111@s.whatsapp.net' })).toBe(
      '556584635111',
    )
  })

  // Foi o que apareceu no log da Evolution: addressingMode 'lid'.
  it('prefere o telefone quando o endereço vem em LID', () => {
    expect(
      numeroDoContato({
        remoteJid: '188889999@lid',
        remoteJidAlt: '556584635111@s.whatsapp.net',
      }),
    ).toBe('556584635111')
  })

  it('só com LID, registra por ele em vez de perder a mensagem', () => {
    expect(numeroDoContato({ remoteJid: '188889999@lid' })).toBe('188889999')
  })

  it('descarta grupo', () => {
    expect(numeroDoContato({ remoteJid: '1234-5678@g.us' })).toBeNull()
  })

  it('descarta transmissão e newsletter', () => {
    expect(numeroDoContato({ remoteJid: 'status@broadcast' })).toBeNull()
    expect(numeroDoContato({ remoteJid: '123@newsletter' })).toBeNull()
  })

  it('grupo no remoteJid não é salvo pelo remoteJidAlt', () => {
    expect(
      numeroDoContato({
        remoteJid: '1234@g.us',
        remoteJidAlt: '1234@g.us',
      }),
    ).toBeNull()
  })

  it('chave ausente ou vazia devolve null', () => {
    expect(numeroDoContato(null)).toBeNull()
    expect(numeroDoContato({})).toBeNull()
  })
})

describe('ehConversaDeContato', () => {
  it('aceita telefone e LID', () => {
    expect(ehConversaDeContato('55119@s.whatsapp.net')).toBe(true)
    expect(ehConversaDeContato('999@lid')).toBe(true)
  })

  it('recusa os coletivos', () => {
    expect(ehConversaDeContato('x@g.us')).toBe(false)
    expect(ehConversaDeContato('status@broadcast')).toBe(false)
  })
})
