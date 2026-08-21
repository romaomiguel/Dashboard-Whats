import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DadosExemploProvider } from '@/components/dados-exemplo-provider'
import { formatarContador, ITENS_NAV, Sidebar } from '@/components/sidebar'

const caminhoAtual = vi.hoisted(() => ({ valor: '/' }))
vi.mock('next/navigation', () => ({
  usePathname: () => caminhoAtual.valor,
}))

function renderizarSidebar() {
  return render(
    <DadosExemploProvider>
      <Sidebar />
    </DadosExemploProvider>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    caminhoAtual.valor = '/'
    window.localStorage.clear()
  })

  it('cobre as oito telas', () => {
    expect(ITENS_NAV.map((i) => i.href)).toEqual([
      '/',
      '/conexao',
      '/contatos',
      '/mensagens',
      '/esteira',
      '/midias',
      '/configuracoes',
      '/disparos',
    ])
  })

  it('dá um subtítulo a cada tela', () => {
    for (const item of ITENS_NAV) {
      expect(item.subtitulo).not.toBe('')
    }
  })

  it('renderiza links de verdade, não botões', () => {
    renderizarSidebar()
    const link = screen.getByRole('link', { name: /Conexão/ })
    expect(link).toHaveAttribute('href', '/conexao')
  })

  it('marca a rota atual com aria-current', () => {
    caminhoAtual.valor = '/disparos'
    renderizarSidebar()
    expect(screen.getByRole('link', { name: /Disparos/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('não marca a home quando se está numa subrota', () => {
    caminhoAtual.valor = '/contatos'
    renderizarSidebar()
    expect(screen.getByRole('link', { name: /Home/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('abrevia contadores de milhar', () => {
    expect(formatarContador(128)).toBe('128')
    expect(formatarContador(4820)).toBe('4.8k')
    expect(formatarContador(2000)).toBe('2k')
  })
})
