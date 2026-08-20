import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PainelConexao } from '@/app/(app)/conexao/painel-conexao'
import type { Conexao } from '@/lib/conexoes'

const acoes = vi.hoisted(() => ({
  criar: vi.fn(),
  qr: vi.fn(),
  verificar: vi.fn(),
  remover: vi.fn(),
  limpar: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/app/(app)/conexao/actions', () => ({
  criarConexao: (...args: unknown[]) => acoes.criar(...args),
  atualizarQr: (id: string) => acoes.qr(id),
  verificarConexao: (id: string) => acoes.verificar(id),
  removerConexao: (id: string) => acoes.remover(id),
  limparOrfas: () => acoes.limpar(),
}))

const QR_FALSO = 'data:image/png;base64,iVBORw0KGgo='

function conexao(sobrepor: Partial<Conexao> = {}): Conexao {
  return {
    id: 'c1',
    nome: 'Comercial 01',
    nomeEvolution: 'inst_abcd1234',
    numero: null,
    status: 'conectando',
    atualizadoEm: '2026-08-20T10:00:00.000Z',
    ...sobrepor,
  }
}

beforeEach(() => {
  acoes.criar.mockResolvedValue({ ok: true, id: 'c9', qr: QR_FALSO })
  acoes.qr.mockResolvedValue({ ok: true, qr: QR_FALSO })
  acoes.verificar.mockResolvedValue({ ok: true, status: 'conectando' })
  acoes.remover.mockResolvedValue({ ok: true })
  acoes.limpar.mockResolvedValue({ ok: true, removidas: 0 })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('sem conexão', () => {
  it('mostra o estado vazio e o botão de criar', () => {
    render(<PainelConexao conexoes={[]} />)

    expect(screen.getByText('Nenhuma conexão')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nova conexão/ })).toBeInTheDocument()
  })

  it('conta zero de zero', () => {
    render(<PainelConexao conexoes={[]} />)
    expect(screen.getByText(/0 de 0/)).toBeInTheDocument()
  })
})

describe('cartões de resumo', () => {
  it('mostra nome, número e o rótulo de status', () => {
    render(
      <PainelConexao
        conexoes={[
          conexao({ status: 'conectada', numero: '+5511900000000' }),
        ]}
      />,
    )

    expect(screen.getByText('Comercial 01')).toBeInTheDocument()
    expect(screen.getByText('+5511900000000')).toBeInTheDocument()
    expect(screen.getByText('Conectado')).toBeInTheDocument()
  })

  it('sem número conectado, explica em vez de deixar vazio', () => {
    render(<PainelConexao conexoes={[conexao()]} />)
    expect(screen.getByText(/Número aparece após conectar/)).toBeInTheDocument()
  })

  it('usa os três rótulos pedidos, um por estado', () => {
    render(
      <PainelConexao
        conexoes={[
          conexao({ id: 'a', nome: 'A', status: 'conectada' }),
          conexao({ id: 'b', nome: 'B', status: 'conectando' }),
          conexao({ id: 'c', nome: 'C', status: 'desconectada' }),
        ]}
      />,
    )

    expect(screen.getByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText('Reconectando')).toBeInTheDocument()
    expect(screen.getByText('Desconectado')).toBeInTheDocument()
  })

  it('lista várias conexões ao mesmo tempo', () => {
    render(
      <PainelConexao
        conexoes={[
          conexao({ id: 'a', nome: 'Comercial', status: 'conectada' }),
          conexao({ id: 'b', nome: 'Suporte', status: 'conectada' }),
          conexao({ id: 'c', nome: 'Financeiro' }),
        ]}
      />,
    )

    expect(screen.getByText('Comercial')).toBeInTheDocument()
    expect(screen.getByText('Suporte')).toBeInTheDocument()
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.getByText(/2 de 3/)).toBeInTheDocument()
  })

  it('conexão conectada não oferece QR; a desconectada oferece', () => {
    render(
      <PainelConexao
        conexoes={[
          conexao({ id: 'a', nome: 'Ligada', status: 'conectada' }),
          conexao({ id: 'b', nome: 'Parada', status: 'desconectada' }),
        ]}
      />,
    )

    expect(screen.getAllByRole('button', { name: /QR Code/ })).toHaveLength(1)
  })
})

describe('remoção', () => {
  it('remove pelo id da conexão escolhida', async () => {
    render(
      <PainelConexao
        conexoes={[
          conexao({ id: 'a', nome: 'Comercial' }),
          conexao({ id: 'b', nome: 'Suporte' }),
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Remover Suporte' }))

    await waitFor(() => expect(acoes.remover).toHaveBeenCalledWith('b'))
  })

  it('mostra o erro devolvido pela ação', async () => {
    acoes.remover.mockResolvedValue({ erro: 'Não foi possível remover a conexão.' })

    render(<PainelConexao conexoes={[conexao()]} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Remover Comercial 01' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível remover a conexão.',
    )
  })
})

describe('diálogo do QR', () => {
  it('abre pelo cartão e pede o QR daquela conexão', async () => {
    render(<PainelConexao conexoes={[conexao({ id: 'xyz' })]} />)

    await userEvent.click(screen.getByRole('button', { name: /QR Code/ }))

    expect(
      await screen.findByAltText('QR code para conectar Comercial 01'),
    ).toBeInTheDocument()
    await waitFor(() => expect(acoes.qr).toHaveBeenCalledWith('xyz'))
  })

  it('deixa pedir um código novo, porque o do WhatsApp vence', async () => {
    render(<PainelConexao conexoes={[conexao()]} />)
    await userEvent.click(screen.getByRole('button', { name: /QR Code/ }))
    await screen.findByAltText('QR code para conectar Comercial 01')

    acoes.qr.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /Gerar novo código/ }))

    await waitFor(() => expect(acoes.qr).toHaveBeenCalledTimes(1))
  })
})

describe('instâncias órfãs', () => {
  // Instância que fica na Evolution sem registro aqui segue tentando
  // reconectar com o mesmo número, e sessão duplicada faz o WhatsApp deslogar
  // o aparelho — foi o que derrubou a conexão em 20/08.
  it('oferece a limpeza mesmo sem conexão registrada', () => {
    render(<PainelConexao conexoes={[]} />)
    expect(screen.getByRole('button', { name: /Limpar órfãs/ })).toBeInTheDocument()
  })

  it('conta quantas foram removidas', async () => {
    acoes.limpar.mockResolvedValue({ ok: true, removidas: 2 })

    render(<PainelConexao conexoes={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Limpar órfãs/ }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 instância(s) órfã(s) removida(s)',
    )
  })

  it('diz quando não há nenhuma, em vez de ficar mudo', async () => {
    render(<PainelConexao conexoes={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Limpar órfãs/ }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Nenhuma instância órfã',
    )
  })

  it('remoção que deixou órfã avisa em vez de fingir sucesso', async () => {
    acoes.remover.mockResolvedValue({
      ok: true,
      erro: 'A conexão saiu daqui, mas a Evolution não respondeu',
    })

    render(
      <PainelConexao
        conexoes={[
          {
            id: 'c1',
            nome: 'Comercial',
            nomeEvolution: 'inst_abcd1234',
            numero: null,
            status: 'conectada' as const,
            atualizadoEm: '2026-08-20T10:00:00.000Z',
          },
        ]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remover Comercial' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'a Evolution não respondeu',
    )
  })
})
