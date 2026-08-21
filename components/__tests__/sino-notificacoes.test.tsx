import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SinoNotificacoes } from '@/components/sino-notificacoes'
import type { Notificacao } from '@/lib/notificacoes'

const acoes = vi.hoisted(() => ({ lida: vi.fn(), todas: vi.fn() }))
const navegacao = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => navegacao,
}))

vi.mock('@/app/(app)/notificacoes/actions', () => ({
  marcarComoLida: (id: string) => acoes.lida(id),
  marcarTodasComoLidas: () => acoes.todas(),
}))

// O canal do Realtime não sobe no jsdom; o teste cobre a lista inicial e as
// interações, e a entrega ao vivo fica para a verificação manual.
vi.mock('@/lib/supabase/client', () => ({
  criarClienteNavegador: () => ({
    channel: () => ({
      on: function () {
        return this
      },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}))

function nota(sobrepor: Partial<Notificacao> = {}): Notificacao {
  return {
    id: 'n1',
    tipo: 'mensagem',
    titulo: 'Amanda respondeu',
    corpo: 'Oi, tudo bem?',
    destino: '/mensagens?busca=556584627628',
    lida: false,
    quando: '2026-08-20T13:00:00.000Z',
    ...sobrepor,
  }
}

beforeEach(() => {
  acoes.lida.mockResolvedValue({ ok: true })
  acoes.todas.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('contador', () => {
  it('mostra quantas não lidas existem', () => {
    render(
      <SinoNotificacoes
        ownerId="user-1"
        iniciais={[nota(), nota({ id: 'n2' })]}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('não mostra contador quando está tudo lido', () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota({ lida: true })]} />)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('passa de nove vira 9+, para não deformar o sino', () => {
    const muitas = Array.from({ length: 12 }, (_, i) => nota({ id: `n${i}` }))
    render(<SinoNotificacoes ownerId="user-1" iniciais={muitas} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })
})

describe('painel', () => {
  it('lista título e corpo ao abrir', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota()]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))

    expect(await screen.findByText('Amanda respondeu')).toBeInTheDocument()
    expect(screen.getByText('Oi, tudo bem?')).toBeInTheDocument()
  })

  it('sem nenhuma, explica em vez de ficar vazio', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))

    expect(await screen.findByText(/Nenhuma notificação/)).toBeInTheDocument()
  })

  it('clicar marca como lida e navega para o destino', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota()]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    await userEvent.click(await screen.findByText('Amanda respondeu'))

    await waitFor(() => expect(acoes.lida).toHaveBeenCalledWith('n1'))
    expect(navegacao.push).toHaveBeenCalledWith('/mensagens?busca=556584627628')
  })

  it('marcar todas zera o contador', async () => {
    render(
      <SinoNotificacoes
        ownerId="user-1"
        iniciais={[nota(), nota({ id: 'n2' })]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /Marcar todas como lidas/ }),
    )

    await waitFor(() => expect(acoes.todas).toHaveBeenCalled())
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('sem nada não lido, não oferece marcar todas', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota({ lida: true })]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))

    await screen.findByText('Amanda respondeu')
    expect(
      screen.queryByRole('button', { name: /Marcar todas como lidas/ }),
    ).not.toBeInTheDocument()
  })

  it('atividade nova na mesma linha volta a acender o sino mesmo já lida', async () => {
    // O upsert do registrador reaproveita a mesma linha (owner_id, chave)
    // quando a mesma conversa gera atividade nova: o id não muda, só `quando`
    // (atualizado_em). Sem chavear a leitura local por isso, o item ficava
    // riscado como lido para sempre depois do primeiro clique.
    const original = nota()
    const { rerender } = render(
      <SinoNotificacoes ownerId="user-1" iniciais={[original]} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    await userEvent.click(await screen.findByText('Amanda respondeu'))

    await waitFor(() => expect(acoes.lida).toHaveBeenCalledWith('n1'))
    expect(screen.queryByText('1')).not.toBeInTheDocument()

    // O servidor devolve a mesma linha (mesmo id), agora com nova mensagem:
    // `quando` mais novo e `lida: false` de novo.
    const comAtividadeNova = nota({
      lida: false,
      quando: '2026-08-20T13:05:00.000Z',
    })
    rerender(<SinoNotificacoes ownerId="user-1" iniciais={[comAtividadeNova]} />)

    expect(await screen.findByText('1')).toBeInTheDocument()
  })

  it('contador diminui ao marcar um item só como lido', async () => {
    render(
      <SinoNotificacoes
        ownerId="user-1"
        iniciais={[nota(), nota({ id: 'n2', titulo: 'Bruno perguntou' })]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    expect(await screen.findByText('2')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Amanda respondeu'))

    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument())
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})

describe('falha da ação', () => {
  it('marcarComoLida falhando desfaz a marcação, mostra o erro e não navega', async () => {
    acoes.lida.mockResolvedValue({ erro: 'Sessão expirada. Entre novamente.' })

    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota()]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    await userEvent.click(await screen.findByText('Amanda respondeu'))

    expect(
      await screen.findByText('Sessão expirada. Entre novamente.'),
    ).toBeInTheDocument()
    // Contador continua 1: a marcação otimista foi desfeita.
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(navegacao.push).not.toHaveBeenCalled()
  })

  it('marcarTodasComoLidas falhando desfaz a marcação e mostra o erro', async () => {
    acoes.todas.mockResolvedValue({
      erro: 'Não foi possível marcar todas como lidas.',
    })

    render(
      <SinoNotificacoes
        ownerId="user-1"
        iniciais={[nota(), nota({ id: 'n2' })]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /Marcar todas como lidas/ }),
    )

    expect(
      await screen.findByText('Não foi possível marcar todas como lidas.'),
    ).toBeInTheDocument()
    // Contador volta a 2: a marcação otimista foi desfeita.
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
