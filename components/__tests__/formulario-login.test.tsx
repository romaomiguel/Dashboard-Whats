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
