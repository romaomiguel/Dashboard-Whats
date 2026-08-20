import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CHAVE_DADOS_EXEMPLO,
  DadosExemploProvider,
} from '@/components/dados-exemplo-provider'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { RESUMO_VAZIO } from '@/lib/consultas/resumo'
import { StatCards } from '@/components/dashboard/stat-cards'

function montar(ui: React.ReactNode) {
  return render(<DadosExemploProvider>{ui}</DadosExemploProvider>)
}

afterEach(() => {
  window.localStorage.clear()
})

describe('dados de exemplo', () => {
  it('começa ligado quando não há preferência salva', async () => {
    montar(<SeloDadosExemplo />)
    expect(await screen.findByText('Dados de exemplo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zerar' })).toBeInTheDocument()
  })

  it('respeita a preferência salva como desligada', async () => {
    window.localStorage.setItem(CHAVE_DADOS_EXEMPLO, 'off')
    montar(<SeloDadosExemplo />)
    expect(
      await screen.findByRole('button', { name: 'Restaurar exemplo' }),
    ).toBeInTheDocument()
  })

  it('Zerar persiste a escolha no localStorage', async () => {
    montar(<SeloDadosExemplo />)
    await userEvent.click(await screen.findByRole('button', { name: 'Zerar' }))
    expect(window.localStorage.getItem(CHAVE_DADOS_EXEMPLO)).toBe('off')
  })

  it('zerar leva os contadores da Home a zero', async () => {
    montar(
      <>
        <SeloDadosExemplo />
        <StatCards resumo={RESUMO_VAZIO} />
      </>,
    )
    expect(await screen.findByText('4.820')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Zerar' }))

    expect(screen.queryByText('4.820')).not.toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('restaurar traz os dados de exemplo de volta', async () => {
    window.localStorage.setItem(CHAVE_DADOS_EXEMPLO, 'off')
    montar(
      <>
        <SeloDadosExemplo />
        <StatCards resumo={RESUMO_VAZIO} />
      </>,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Restaurar exemplo' }),
    )
    expect(screen.getByText('4.820')).toBeInTheDocument()
  })
})
