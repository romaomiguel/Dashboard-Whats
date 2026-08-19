import { describe, expect, it } from 'vitest'
import { endpoints } from '@/lib/evolution/endpoints'

describe('endpoints', () => {
  it('monta o caminho de criação de instância', () => {
    expect(endpoints.instancia.criar()).toBe('/instance/create')
  })

  it('interpola o nome da instância', () => {
    expect(endpoints.instancia.conectar('inst_a1b2')).toBe(
      '/instance/connect/inst_a1b2',
    )
    expect(endpoints.instancia.estado('inst_a1b2')).toBe(
      '/instance/connectionState/inst_a1b2',
    )
  })

  it('escapa nome com caractere especial', () => {
    expect(endpoints.instancia.conectar('a/b')).toBe('/instance/connect/a%2Fb')
  })

  it('expõe os caminhos de webhook, mensagem e chat', () => {
    expect(endpoints.webhook.definir('i')).toBe('/webhook/set/i')
    expect(endpoints.mensagem.texto('i')).toBe('/message/sendText/i')
    expect(endpoints.chat.contatos('i')).toBe('/chat/findContacts/i')
  })
})
