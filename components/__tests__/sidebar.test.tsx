import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ITENS_NAV, Sidebar } from '@/components/sidebar'

const caminhoAtual = vi.hoisted(() => ({ valor: '/' }))
vi.mock('next/navigation', () => ({
  usePathname: () => caminhoAtual.valor,
}))

describe('Sidebar', () => {
  beforeEach(() => {
    caminhoAtual.valor = '/'
  })

  it('cobre as sete telas', () => {
    expect(ITENS_NAV.map((i) => i.href)).toEqual([
      '/',
      '/conexao',
      '/contatos',
      '/mensagens',
      '/midias',
      '/configuracoes',
      '/disparos',
    ])
  })

  it('renderiza links de verdade, não botões', () => {
    render(<Sidebar />)
    const link = screen.getByRole('link', { name: /Conexão/ })
    expect(link).toHaveAttribute('href', '/conexao')
  })

  it('marca a rota atual com aria-current', () => {
    caminhoAtual.valor = '/disparos'
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /Disparos/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('não marca a home quando se está numa subrota', () => {
    caminhoAtual.valor = '/contatos'
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /Home/ })).not.toHaveAttribute(
      'aria-current',
    )
  })
})
