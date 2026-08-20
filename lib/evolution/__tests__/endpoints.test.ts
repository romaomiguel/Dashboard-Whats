import { describe, expect, it } from 'vitest'
import { endpoints } from '@/lib/evolution/endpoints'
import { EvolutionError } from '@/lib/evolution/errors'

describe('endpoints', () => {
  it('monta o caminho de criação de instância', () => {
    expect(endpoints.instancia.criar()).toBe('/instance/create')
  })

  it('interpola o nome válido da instância', () => {
    expect(endpoints.instancia.conectar('inst_a1b2c3d4')).toBe(
      '/instance/connect/inst_a1b2c3d4',
    )
    expect(endpoints.instancia.estado('inst_a1b2c3d4')).toBe(
      '/instance/connectionState/inst_a1b2c3d4',
    )
  })

  it('rejeita nome inválido (barra)', () => {
    expect(() => endpoints.instancia.conectar('a/b')).toThrow(EvolutionError)
    try {
      endpoints.instancia.conectar('a/b')
      expect.unreachable()
    } catch (erro) {
      expect(erro).toMatchObject({ kind: 'nome_invalido' })
    }
  })

  it('rejeita path traversal com ponto', () => {
    const casosInvalidos = ['.', '..', '../..', '../../admin', 'inst_../x']
    for (const nome of casosInvalidos) {
      expect(() => endpoints.instancia.conectar(nome)).toThrow(EvolutionError)
      try {
        endpoints.instancia.conectar(nome)
        expect.unreachable()
      } catch (erro) {
        expect(erro).toMatchObject({ kind: 'nome_invalido' })
      }
    }
  })

  it('rejeita formato inválido (maiúsculas, comprimento errado, vazio)', () => {
    const casosInvalidos = [
      'INST_A1B2C3D4', // maiúsculas
      'inst_a1b2c3d',  // 7 hex (faltam 1)
      'inst_a1b2c3d44', // 9 hex (1 a mais)
      '',               // vazio
    ]
    for (const nome of casosInvalidos) {
      expect(() => endpoints.instancia.conectar(nome)).toThrow(EvolutionError)
    }
  })

  it('nenhuma URL é montada para nome rejeitado', () => {
    // Se a validação rejeita, fetch nunca é chamado.
    // Este teste comprova que a rejeição acontece no ponto de validação,
    // não depois na concatenação de URL.
    expect(() => endpoints.instancia.conectar('..')).toThrow()
    expect(() => endpoints.instancia.estado('../../admin')).toThrow()
    expect(() => endpoints.webhook.definir('.')).toThrow()
    expect(() => endpoints.mensagem.texto('..')).toThrow()
    expect(() => endpoints.chat.contatos('../')).toThrow()
  })

  it('expõe os caminhos de webhook, mensagem e chat com nome válido', () => {
    expect(endpoints.webhook.definir('inst_a1b2c3d4')).toBe('/webhook/set/inst_a1b2c3d4')
    expect(endpoints.mensagem.texto('inst_a1b2c3d4')).toBe('/message/sendText/inst_a1b2c3d4')
    expect(endpoints.chat.contatos('inst_a1b2c3d4')).toBe('/chat/findContacts/inst_a1b2c3d4')
  })
})

describe('nome inválido não é erro de configuração', () => {
  it('o formato de teste antigo é rejeitado com o tipo certo', () => {
    // A linha que o teste de RLS deixava no banco tinha este formato, e
    // classificá-la como 'configuracao' fazia a tela pedir variável de
    // ambiente para um nome malformado.
    expect(() => endpoints.instancia.conectar('inst_teste_1787199627206')).toThrow(
      expect.objectContaining({ kind: 'nome_invalido' }),
    )
  })

  it('nome no formato correto passa', () => {
    expect(endpoints.instancia.conectar('inst_a1b2c3d4')).toBe(
      '/instance/connect/inst_a1b2c3d4',
    )
  })
})
