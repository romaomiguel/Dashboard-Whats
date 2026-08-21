import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Thread } from '@/app/(app)/mensagens/[numero]/thread'
import type { MensagemDaConversa } from '@/lib/consultas/conversa'

const acoes = vi.hoisted(() => ({ enviar: vi.fn() }))
const navegacao = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => navegacao }))
vi.mock('@/app/(app)/mensagens/actions', () => ({
  enviarMensagem: (n: string, t: string) => acoes.enviar(n, t),
}))
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

function msg(sobrepor: Partial<MensagemDaConversa> = {}): MensagemDaConversa {
  return {
    id: 'm1',
    direcao: 'entrada',
    status: 'recebida',
    texto: 'Oi, tudo bem?',
    quando: '2026-08-21T10:00:00.000Z',
    erro: null,
    nome: null,
    ...sobrepor,
  }
}

beforeEach(() => {
  acoes.enviar.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('thread', () => {
  it('mostra as mensagens das duas direções', () => {
    render(
      <Thread
        numero="556584038479"
        nome="Matheus"
        iniciais={[msg(), msg({ id: 'm2', direcao: 'saida', status: 'enviada', texto: 'Tudo, e você?' })]}
      />,
    )
    expect(screen.getByText('Oi, tudo bem?')).toBeInTheDocument()
    expect(screen.getByText('Tudo, e você?')).toBeInTheDocument()
  })

  // Conversa nova precisa explicar o vazio em vez de parecer quebrada.
  it('explica a conversa sem histórico', () => {
    render(<Thread numero="556584038479" nome="Matheus" iniciais={[]} />)
    expect(screen.getByText(/Nenhuma mensagem/)).toBeInTheDocument()
  })

  it('envia o que foi escrito e limpa a caixa', async () => {
    render(<Thread numero="556584038479" nome="Matheus" iniciais={[msg()]} />)

    const caixa = screen.getByRole('textbox', { name: /Mensagem/ })
    await userEvent.type(caixa, 'Bom dia')
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }))

    expect(acoes.enviar).toHaveBeenCalledWith('556584038479', 'Bom dia')
    await waitFor(() => expect(caixa).toHaveValue(''))
  })

  // Caixa vazia não pode disparar ida ao servidor.
  it('não envia caixa vazia', async () => {
    render(<Thread numero="556584038479" nome="Matheus" iniciais={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }))

    expect(acoes.enviar).not.toHaveBeenCalled()
  })

  // O texto não pode sumir num erro: o usuário perderia o que escreveu.
  it('mantém o texto na caixa quando o envio falha', async () => {
    acoes.enviar.mockResolvedValue({ erro: 'Não foi possível entregar a mensagem.' })
    render(<Thread numero="556584038479" nome="Matheus" iniciais={[]} />)

    const caixa = screen.getByRole('textbox', { name: /Mensagem/ })
    await userEvent.type(caixa, 'Bom dia')
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i)
    expect(caixa).toHaveValue('Bom dia')
  })

  it('marca visualmente a mensagem que falhou', () => {
    render(
      <Thread
        numero="556584038479"
        nome="Matheus"
        iniciais={[msg({ direcao: 'saida', status: 'falhou', texto: 'não saiu', erro: 'timeout' })]}
      />,
    )
    expect(screen.getByText(/Não entregue/)).toBeInTheDocument()
  })

  // Falha de transporte da server action (offline, 500, requisição abortada)
  // rejeita a promise em vez de resolver com `{ erro }`. Sem o catch, o botão
  // ficava desabilitado para sempre e não aparecia nenhum aviso.
  it('avisa e reabilita o botão quando o envio rejeita a promise', async () => {
    acoes.enviar.mockRejectedValue(new Error('falha de rede'))
    render(<Thread numero="556584038479" nome="Matheus" iniciais={[]} />)

    const caixa = screen.getByRole('textbox', { name: /Mensagem/ })
    const botao = screen.getByRole('button', { name: /Enviar/ })
    await userEvent.type(caixa, 'Bom dia')
    await userEvent.click(botao)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(caixa).toHaveValue('Bom dia')
    await waitFor(() => expect(botao).not.toBeDisabled())
  })
})
