import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FormularioLogin } from '@/app/login/formulario-login'

vi.mock('react-dom', async (original) => {
  const real = await original<typeof import('react-dom')>()
  return { ...real, useFormStatus: () => ({ pending: false }) }
})

describe('FormularioLogin', () => {
  it('mostra campos de e-mail e senha', () => {
    render(<FormularioLogin acao={async () => ({})} />)
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
  })

  it('exibe a mensagem de erro devolvida pela ação', () => {
    render(
      <FormularioLogin
        acao={async () => ({ erro: 'E-mail ou senha inválidos.' })}
        estadoInicial={{ erro: 'E-mail ou senha inválidos.' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos.',
    )
  })

  it('não exibe alerta quando não há erro', () => {
    render(<FormularioLogin acao={async () => ({})} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('mostrar senha', () => {
  it('começa oculta e alterna para texto', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(<FormularioLogin acao={async () => ({})} />)

    const senha = screen.getByLabelText('Senha')
    expect(senha).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(senha).toHaveAttribute('type', 'password')
  })

  it('leva o destino junto no formulário', () => {
    const { container } = render(
      <FormularioLogin acao={async () => ({})} destino="/contatos" />,
    )
    const oculto = container.querySelector('input[name="destino"]')
    expect(oculto).toHaveValue('/contatos')
  })
})

describe('tamanho dos campos', () => {
  it('usa campos altos e texto legível, não os compactos do padrão', () => {
    render(<FormularioLogin acao={async () => ({})} />)

    for (const campo of [screen.getByLabelText('E-mail'), screen.getByLabelText('Senha')]) {
      expect(campo.className).toContain('h-11')
      expect(campo.className).toContain('text-base')
      // h-8 é o padrão compacto do design system; aqui ele não serve.
      expect(campo.className).not.toMatch(/\bh-8\b/)
    }

    expect(screen.getByRole('button', { name: 'Entrar' }).className).toContain('h-11')
  })
})
