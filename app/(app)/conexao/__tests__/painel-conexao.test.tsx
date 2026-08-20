import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PainelConexao } from '@/app/(app)/conexao/painel-conexao'
import type { Conexao } from '@/lib/consultas/conexao'

const acoes = vi.hoisted(() => ({
  criar: vi.fn(),
  qr: vi.fn(),
  verificar: vi.fn(),
  remover: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/app/(app)/conexao/actions', () => ({
  criarConexao: () => acoes.criar(),
  atualizarQr: () => acoes.qr(),
  verificarConexao: () => acoes.verificar(),
  removerConexao: () => acoes.remover(),
}))

const QR_FALSO = 'data:image/png;base64,iVBORw0KGgo='

const conexaoConectando: Conexao = {
  id: 'c1',
  nomeEvolution: 'inst_abcd1234',
  numero: null,
  status: 'conectando',
  atualizadoEm: '2026-08-20T10:00:00.000Z',
}

beforeEach(() => {
  acoes.criar.mockResolvedValue({ ok: true, qr: QR_FALSO, status: 'conectando' })
  acoes.qr.mockResolvedValue({ ok: true, qr: QR_FALSO })
  acoes.verificar.mockResolvedValue({ ok: true, status: 'conectando' })
  acoes.remover.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('sem conexão', () => {
  it('oferece conectar, sem QR na tela', () => {
    render(<PainelConexao conexao={null} />)

    expect(
      screen.getByRole('button', { name: /Conectar WhatsApp/ }),
    ).toBeInTheDocument()
    expect(screen.queryByAltText(/QR code/)).not.toBeInTheDocument()
  })

  it('avisa sobre a hibernação enquanto a criação está em curso', async () => {
    // A Evolution no plano free do Render leva até 90s para acordar; sem esse
    // aviso a tela parece travada.
    let liberar: (v: unknown) => void = () => {}
    acoes.criar.mockReturnValue(new Promise((resolve) => (liberar = resolve)))

    render(<PainelConexao conexao={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Conectar WhatsApp/ }))

    expect(await screen.findByText(/até 90 segundos/)).toBeInTheDocument()

    liberar({ ok: true, qr: QR_FALSO, status: 'conectando' })
  })

  it('mostra o erro devolvido pela ação', async () => {
    acoes.criar.mockResolvedValue({ erro: 'A Evolution API não respondeu.' })

    render(<PainelConexao conexao={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Conectar WhatsApp/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A Evolution API não respondeu.',
    )
  })
})

describe('aguardando leitura do QR', () => {
  it('busca o QR sozinho ao abrir e o mostra', async () => {
    render(<PainelConexao conexao={conexaoConectando} />)

    const imagem = await screen.findByAltText('QR code para conectar o WhatsApp')
    expect(imagem).toHaveAttribute('src', QR_FALSO)
    expect(acoes.qr).toHaveBeenCalled()
  })

  it('deixa pedir um código novo, porque o do WhatsApp vence', async () => {
    render(<PainelConexao conexao={conexaoConectando} />)
    await screen.findByAltText('QR code para conectar o WhatsApp')

    acoes.qr.mockClear()
    await userEvent.click(
      screen.getByRole('button', { name: /Gerar novo código/ }),
    )

    await waitFor(() => expect(acoes.qr).toHaveBeenCalledTimes(1))
  })

  it('identifica a instância pelo nome na Evolution', () => {
    render(<PainelConexao conexao={conexaoConectando} />)
    expect(screen.getByText('inst_abcd1234')).toBeInTheDocument()
  })
})

describe('conectada', () => {
  const conectada: Conexao = {
    ...conexaoConectando,
    status: 'conectada',
    numero: '+55 11 90000-0000',
  }

  it('troca o QR pelo número conectado', () => {
    render(<PainelConexao conexao={conectada} />)

    expect(screen.getByText('WhatsApp conectado')).toBeInTheDocument()
    expect(screen.getByText('+55 11 90000-0000')).toBeInTheDocument()
    expect(
      screen.queryByAltText('QR code para conectar o WhatsApp'),
    ).not.toBeInTheDocument()
  })

  it('não fica pedindo QR depois de conectada', async () => {
    render(<PainelConexao conexao={conectada} />)
    await waitFor(() => expect(acoes.qr).not.toHaveBeenCalled())
  })

  it('permite remover a conexão', async () => {
    render(<PainelConexao conexao={conectada} />)
    await userEvent.click(
      screen.getByRole('button', { name: /Remover conexão/ }),
    )

    await waitFor(() => expect(acoes.remover).toHaveBeenCalled())
  })
})
