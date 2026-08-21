import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Quadro } from '@/app/(app)/esteira/quadro'
import { ETAPAS_PADRAO, LIMITE_NOME_ETAPA } from '@/lib/esteira'

const acoes = vi.hoisted(() => ({ mover: vi.fn(), criar: vi.fn(), remover: vi.fn() }))
const navegacao = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => navegacao }))
vi.mock('@/app/(app)/esteira/actions', () => ({
  moverContato: (c: string, e: string | null) => acoes.mover(c, e),
  criarEtapa: (n: string) => acoes.criar(n),
  removerEtapa: (id: string) => acoes.remover(id),
}))

const etapas = [
  { id: 'e1', nome: 'Novo', ordem: 0 },
  { id: 'e2', nome: 'Negociando', ordem: 1 },
]

const contatos = [
  { id: 'c1', nome: 'Matheus', numero: '556584038479', etapaId: 'e1' },
  { id: 'c2', nome: 'Ana', numero: '5511999998888', etapaId: null },
]

beforeEach(() => {
  acoes.mover.mockResolvedValue({ ok: true })
  acoes.criar.mockResolvedValue({ ok: true })
  acoes.remover.mockResolvedValue({ ok: true })
})

afterEach(() => vi.clearAllMocks())

describe('quadro', () => {
  it('mostra uma coluna por etapa', () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)
    expect(screen.getByRole('heading', { name: 'Novo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Negociando' })).toBeInTheDocument()
  })

  // Quem acabou de ser importado não tem etapa; escondê-lo faria sumir
  // justamente quem precisa ser triado.
  it('mostra os sem etapa numa coluna própria', () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)
    const coluna = screen.getByRole('region', { name: /Sem etapa/ })
    expect(within(coluna).getByText('Ana')).toBeInTheDocument()
  })

  it('põe cada contato na coluna da etapa dele', () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)
    const coluna = screen.getByRole('region', { name: 'Novo' })
    expect(within(coluna).getByText('Matheus')).toBeInTheDocument()
  })

  it('move o contato pela escolha de etapa', async () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)

    const seletor = screen.getByLabelText(/Etapa de Matheus/)
    await userEvent.selectOptions(seletor, 'e2')

    expect(acoes.mover).toHaveBeenCalledWith('c1', 'e2')
  })

  it('permite tirar o contato da esteira', async () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)

    const seletor = screen.getByLabelText(/Etapa de Matheus/)
    await userEvent.selectOptions(seletor, '')

    expect(acoes.mover).toHaveBeenCalledWith('c1', null)
  })

  it('avisa quando mover falha', async () => {
    acoes.mover.mockResolvedValue({ erro: 'Contato não encontrado.' })
    render(<Quadro etapas={etapas} contatos={contatos} />)

    await userEvent.selectOptions(screen.getByLabelText(/Etapa de Matheus/), 'e2')

    expect(await screen.findByRole('alert')).toHaveTextContent(/não encontrado/i)
  })

  // Esteira sem etapa nenhuma precisa dizer o que fazer.
  it('explica o quadro vazio', () => {
    render(<Quadro etapas={[]} contatos={[]} />)
    expect(screen.getByText(/Crie a primeira etapa/)).toBeInTheDocument()
  })

  // --- Formulário "Nova etapa" (sempre visível, não só no vazio) ---

  it('cria uma nova etapa pelo formulário', async () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)

    const campo = screen.getByLabelText(/Nome da nova etapa/)
    await userEvent.type(campo, 'Proposta')
    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))

    expect(acoes.criar).toHaveBeenCalledWith('Proposta')
    await waitFor(() => expect(campo).toHaveValue(''))
    expect(navegacao.refresh).toHaveBeenCalled()
  })

  it('não envia nome de etapa vazio ou só espaço', async () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)

    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))
    expect(acoes.criar).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/Nome da nova etapa/), '   ')
    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))
    expect(acoes.criar).not.toHaveBeenCalled()
  })

  it('limita o nome da nova etapa ao teto de caracteres', () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)
    const campo = screen.getByLabelText(/Nome da nova etapa/) as HTMLInputElement
    expect(campo.maxLength).toBe(LIMITE_NOME_ETAPA)
  })

  it('avisa quando criar etapa falha', async () => {
    acoes.criar.mockResolvedValue({ erro: 'Você já tem uma etapa com esse nome.' })
    render(<Quadro etapas={etapas} contatos={contatos} />)

    await userEvent.type(screen.getByLabelText(/Nome da nova etapa/), 'Novo')
    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/etapa com esse nome/i)
  })

  // --- "Criar funil padrão" no vazio ---

  it('cria o funil padrão em ordem a partir do quadro vazio', async () => {
    render(<Quadro etapas={[]} contatos={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /Criar funil padrão/ }))

    await waitFor(() => expect(acoes.criar).toHaveBeenCalledTimes(ETAPAS_PADRAO.length))
    ETAPAS_PADRAO.forEach((nome, i) => {
      expect(acoes.criar).toHaveBeenNthCalledWith(i + 1, nome)
    })
    expect(navegacao.refresh).toHaveBeenCalled()
  })

  it('para na primeira falha ao criar o funil padrão', async () => {
    acoes.criar
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ erro: 'Você já tem uma etapa com esse nome.' })

    render(<Quadro etapas={[]} contatos={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Criar funil padrão/ }))

    await waitFor(() => expect(acoes.criar).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('alert')).toHaveTextContent(/etapa com esse nome/i)
    expect(navegacao.refresh).not.toHaveBeenCalled()
  })

  // --- Remover etapa, sem modal do navegador ---

  it('remove a etapa depois de confirmar com um segundo clique', async () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)

    const coluna = screen.getByRole('region', { name: 'Novo' })
    const botao = within(coluna).getByRole('button', { name: /Remover/ })

    await userEvent.click(botao)
    expect(acoes.remover).not.toHaveBeenCalled()

    await userEvent.click(botao)
    expect(acoes.remover).toHaveBeenCalledWith('e1')
    expect(navegacao.refresh).toHaveBeenCalled()
  })

  it('avisa quando remover etapa falha', async () => {
    acoes.remover.mockResolvedValue({ erro: 'Não foi possível remover a etapa.' })
    render(<Quadro etapas={etapas} contatos={contatos} />)

    const coluna = screen.getByRole('region', { name: 'Novo' })
    const botao = within(coluna).getByRole('button', { name: /Remover/ })
    await userEvent.click(botao)
    await userEvent.click(botao)

    expect(await screen.findByRole('alert')).toHaveTextContent(/remover a etapa/i)
  })

  it('não mostra controle de remover na coluna "Sem etapa"', () => {
    render(<Quadro etapas={etapas} contatos={contatos} />)
    const coluna = screen.getByRole('region', { name: /Sem etapa/ })
    expect(within(coluna).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument()
  })
})
