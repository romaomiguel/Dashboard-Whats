import { describe, expect, it } from 'vitest'
import { deveNotificarQueda } from '@/lib/notificacoes'

describe('deveNotificarQueda', () => {
  // Toda instância nasce fechada: sem a condição de vir de conectada, criar
  // uma conexão avisaria queda antes de o QR ser lido.
  it('não avisa quando a conexão nunca esteve conectada', () => {
    expect(deveNotificarQueda('criada', 'close')).toBe(false)
    expect(deveNotificarQueda('conectando', 'close')).toBe(false)
  })

  it('avisa quando cai depois de conectada', () => {
    expect(deveNotificarQueda('conectada', 'close')).toBe(true)
  })

  it('não avisa quando conecta', () => {
    expect(deveNotificarQueda('conectando', 'open')).toBe(false)
  })

  it('não avisa de novo se já estava desconectada', () => {
    expect(deveNotificarQueda('desconectada', 'close')).toBe(false)
  })
})
