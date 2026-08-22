import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Quadro } from '@/app/(app)/esteira/quadro'
import { ETAPAS_PADRAO, LIMITE_NOME_ETAPA } from '@/lib/esteira'

const acoes = vi.hoisted(() => ({
  mover: vi.fn(),
  criar: vi.fn(),
  remover: vi.fn(),
  definirPapel: vi.fn(),
}))
const navegacao = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => navegacao }))
vi.mock('@/app/(app)/esteira/actions', () => ({
  moverNoFunil: (f: string, e: string) => acoes.mover(f, e),
  criarEtapa: (n: string) => acoes.criar(n),
  removerEtapa: (id: string) => acoes.remover(id),
  definirPapel: (id: string, p: string | null) => acoes.definirPapel(id, p),
}))

const etapas = [
  { id: 'e1', nome: 'Novo', ordem: 0, papel: null },
  { id: 'e2', nome: 'Negociando', ordem: 1, papel: null },
]

// `linhas` são linhas do funil, não contatos: o `id` é o da linha do funil,
// que é justamente o que `moverNoFunil` recebe.
const linhas = [
  { id: 'f1', nome: 'Matheus', numero: '556584038479', etapaId: 'e1' },
  { id: 'f2', nome: 'Ana', numero: '5511999998888', etapaId: 'e2' },
]

beforeEach(() => {
  acoes.mover.mockResolvedValue({ ok: true })
  acoes.criar.mockResolvedValue({ ok: true, id: 'nova' })
  acoes.remover.mockResolvedValue({ ok: true })
  acoes.definirPapel.mockResolvedValue({ ok: true })
})

afterEach(() => vi.clearAllMocks())

describe('quadro', () => {
  it('mostra uma coluna por etapa', () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)
    expect(screen.getByRole('heading', { name: 'Novo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Negociando' })).toBeInTheDocument()
  })

  it('põe cada conversa na coluna da etapa dela', () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)
    expect(
      within(screen.getByRole('region', { name: 'Novo' })).getByText('Matheus'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Negociando' })).getByText('Ana'),
    ).toBeInTheDocument()
  })

  // Sem a coluna "Sem etapa", a linha que aponta para etapa apagada (ou para
  // etapa criada em outra aba depois desta leitura) simplesmente não aparece;
  // a próxima mensagem daquela conversa a devolve para a entrada.
  it('não mostra a conversa de etapa desconhecida em coluna nenhuma', () => {
    const desgarrada = {
      id: 'f3',
      nome: 'Carla',
      numero: '5511977776666',
      etapaId: 'etapa-que-nao-veio-na-leitura',
    }
    render(<Quadro etapas={etapas} linhas={[...linhas, desgarrada]} />)

    expect(screen.queryByText('Carla')).not.toBeInTheDocument()
  })

  // A alça é o que torna o arraste alcançável por teclado; sem nome
  // acessível, quem usa leitor de tela não sabe qual card vai mover.
  it('dá a cada card uma alça de arrastar com nome', () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)
    expect(screen.getByRole('button', { name: 'Mover Matheus' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mover Ana' })).toBeInTheDocument()
  })

  // Esteira sem etapa nenhuma precisa dizer o que fazer.
  it('explica o quadro vazio', () => {
    render(<Quadro etapas={[]} linhas={[]} />)
    expect(screen.getByText(/Crie a primeira etapa/)).toBeInTheDocument()
  })
})

describe('busca', () => {
  it('filtra os cards por nome em todas as colunas', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)

    await userEvent.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'Ana')

    expect(screen.queryByText('Matheus')).not.toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  // O contato foi salvo com o nono dígito e a conversa veio sem: buscar por
  // qualquer das duas formas tem de achar.
  it('acha pelo número nas duas formas do nono dígito', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)

    await userEvent.type(screen.getByRole('searchbox', { name: /Buscar/ }), '5565984038479')

    expect(screen.getByText('Matheus')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('o contador da coluna acompanha o filtro', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)

    await userEvent.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'Ana')

    const coluna = screen.getByRole('region', { name: 'Novo' })
    expect(within(coluna).getByText('0')).toBeInTheDocument()
  })
})

describe('papel da etapa', () => {
  it('marca a etapa como entrada', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)

    await userEvent.click(screen.getByRole('button', { name: /Usar Novo como entrada/ }))

    expect(acoes.definirPapel).toHaveBeenCalledWith('e1', 'entrada')
  })

  // Clicar no papel que a etapa já tem é o único jeito de desligar a
  // automação sem apagar a coluna.
  it('tira o papel ao clicar no papel que a etapa já tem', async () => {
    const comEntrada = [{ ...etapas[0], papel: 'entrada' as const }, etapas[1]]
    render(<Quadro etapas={comEntrada} linhas={linhas} />)

    await userEvent.click(screen.getByRole('button', { name: /Usar Novo como entrada/ }))

    expect(acoes.definirPapel).toHaveBeenCalledWith('e1', null)
  })

  it('mostra o papel atual no botão', () => {
    const comEntrada = [{ ...etapas[0], papel: 'entrada' as const }, etapas[1]]
    render(<Quadro etapas={comEntrada} linhas={linhas} />)

    expect(screen.getByRole('button', { name: /Usar Novo como entrada/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Usar Novo como respondeu/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('avisa quando definir o papel falha', async () => {
    acoes.definirPapel.mockResolvedValue({
      erro: 'Esse papel já pertence a outra etapa. Tire dela primeiro.',
    })
    render(<Quadro etapas={etapas} linhas={linhas} />)

    await userEvent.click(screen.getByRole('button', { name: /Usar Novo como entrada/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/já pertence a outra etapa/i)
  })
})

describe('formulário de nova etapa', () => {
  it('cria uma nova etapa pelo formulário', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)

    const campo = screen.getByLabelText(/Nome da nova etapa/)
    await userEvent.type(campo, 'Proposta')
    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))

    expect(acoes.criar).toHaveBeenCalledWith('Proposta')
    await waitFor(() => expect(campo).toHaveValue(''))
    expect(navegacao.refresh).toHaveBeenCalled()
  })

  it('não envia nome de etapa vazio ou só espaço', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)

    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))
    expect(acoes.criar).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/Nome da nova etapa/), '   ')
    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))
    expect(acoes.criar).not.toHaveBeenCalled()
  })

  it('limita o nome da nova etapa ao teto de caracteres', () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)
    const campo = screen.getByLabelText(/Nome da nova etapa/) as HTMLInputElement
    expect(campo.maxLength).toBe(LIMITE_NOME_ETAPA)
  })

  it('avisa quando criar etapa falha', async () => {
    acoes.criar.mockResolvedValue({ erro: 'Você já tem uma etapa com esse nome.' })
    render(<Quadro etapas={etapas} linhas={linhas} />)

    await userEvent.type(screen.getByLabelText(/Nome da nova etapa/), 'Novo')
    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/etapa com esse nome/i)
  })

  // Sem essa guarda, o segundo clique bate no nome que o primeiro acabou de
  // criar e pinta "etapa com esse nome" sobre uma criação que funcionou.
  it('não duplica a criação com um segundo clique enquanto a primeira ainda está em voo', async () => {
    let resolverCriacao: (v: { ok: boolean }) => void = () => {}
    acoes.criar.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverCriacao = resolve
        }),
    )

    render(<Quadro etapas={etapas} linhas={linhas} />)
    await userEvent.type(screen.getByLabelText(/Nome da nova etapa/), 'Proposta')

    const botao = screen.getByRole('button', { name: /Adicionar etapa/ })
    await userEvent.click(botao) // dispara a criação; a promise ainda não resolveu

    expect(botao).toBeDisabled()
    await userEvent.click(botao) // não deve nem chegar ao handler

    resolverCriacao({ ok: true })
    await waitFor(() => expect(botao).not.toBeDisabled())

    expect(acoes.criar).toHaveBeenCalledTimes(1)
  })
})

describe('funil padrão', () => {
  it('cria o funil padrão em ordem a partir do quadro vazio', async () => {
    render(<Quadro etapas={[]} linhas={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /Criar funil padrão/ }))

    await waitFor(() => expect(acoes.criar).toHaveBeenCalledTimes(ETAPAS_PADRAO.length))
    ETAPAS_PADRAO.forEach((nome, i) => {
      expect(acoes.criar).toHaveBeenNthCalledWith(i + 1, nome)
    })
    expect(navegacao.refresh).toHaveBeenCalled()
  })

  // Sem os papéis o funil padrão nasceria bonito e inerte: nenhuma conversa
  // nova entraria sozinha e ninguém seria promovido ao responder.
  it('dá o papel às duas primeiras etapas do funil padrão', async () => {
    acoes.criar.mockImplementation((nome: string) =>
      Promise.resolve({ ok: true, id: 'id-' + nome }),
    )

    render(<Quadro etapas={[]} linhas={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Criar funil padrão/ }))

    await waitFor(() => expect(acoes.definirPapel).toHaveBeenCalledTimes(2))
    expect(acoes.definirPapel).toHaveBeenNthCalledWith(1, 'id-' + ETAPAS_PADRAO[0], 'entrada')
    expect(acoes.definirPapel).toHaveBeenNthCalledWith(2, 'id-' + ETAPAS_PADRAO[1], 'respondeu')
  })

  it('para na primeira falha ao criar o funil padrão', async () => {
    acoes.criar
      .mockResolvedValueOnce({ ok: true, id: 'id-1' })
      .mockResolvedValueOnce({ erro: 'Você já tem uma etapa com esse nome.' })

    render(<Quadro etapas={[]} linhas={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Criar funil padrão/ }))

    await waitFor(() => expect(acoes.criar).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('alert')).toHaveTextContent(/etapa com esse nome/i)
  })

  // As etapas anteriores já foram gravadas antes da falha: sem o refresh
  // aqui, o quadro continua mostrando o estado vazio e some o progresso já
  // feito, levando a pessoa a tentar de novo e bater na etapa duplicada.
  it('atualiza a tela mesmo quando o funil padrão para por erro no meio', async () => {
    acoes.criar
      .mockResolvedValueOnce({ ok: true, id: 'id-1' })
      .mockResolvedValueOnce({ erro: 'Você já tem uma etapa com esse nome.' })

    render(<Quadro etapas={[]} linhas={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Criar funil padrão/ }))

    await waitFor(() => expect(acoes.criar).toHaveBeenCalledTimes(2))
    await screen.findByRole('alert')
    expect(navegacao.refresh).toHaveBeenCalled()
  })
})

describe('remover etapa, sem modal do navegador', () => {
  it('remove a etapa depois de confirmar com um segundo clique', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)

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
    render(<Quadro etapas={etapas} linhas={linhas} />)

    const coluna = screen.getByRole('region', { name: 'Novo' })
    const botao = within(coluna).getByRole('button', { name: /Remover/ })
    await userEvent.click(botao)
    await userEvent.click(botao)

    expect(await screen.findByRole('alert')).toHaveTextContent(/remover a etapa/i)
  })

  // Com N etapas, "Remover" sozinho não diz qual: quem usa leitor de tela ou
  // comando de voz não sabe em qual botão está. O nome acessível carrega a
  // etapa nos dois estados (neutro e armado).
  it('nomeia o controle de remover com a etapa, nos dois estados', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)
    const coluna = screen.getByRole('region', { name: 'Novo' })

    const botao = within(coluna).getByRole('button', { name: 'Remover etapa Novo' })
    await userEvent.click(botao)

    expect(
      within(coluna).getByRole('button', { name: 'Confirmar remoção da etapa Novo?' }),
    ).toBeInTheDocument()
  })

  it('desarma a remoção pendente ao criar uma nova etapa', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)
    const coluna = screen.getByRole('region', { name: 'Novo' })

    await userEvent.click(within(coluna).getByRole('button', { name: 'Remover etapa Novo' }))
    await userEvent.type(screen.getByLabelText(/Nome da nova etapa/), 'Proposta')
    await userEvent.click(screen.getByRole('button', { name: /Adicionar etapa/ }))

    await userEvent.click(within(coluna).getByRole('button', { name: 'Remover etapa Novo' }))
    expect(acoes.remover).not.toHaveBeenCalled()
  })

  // Mesma razão do caso acima, por outro caminho: marcar papel é a outra ação
  // da barra da coluna, e ela não pode deixar uma remoção armada esperando um
  // clique perdido tempos depois.
  it('desarma a remoção pendente ao marcar o papel da etapa', async () => {
    render(<Quadro etapas={etapas} linhas={linhas} />)
    const coluna = screen.getByRole('region', { name: 'Novo' })

    await userEvent.click(within(coluna).getByRole('button', { name: 'Remover etapa Novo' }))
    await userEvent.click(screen.getByRole('button', { name: /Usar Novo como entrada/ }))

    await userEvent.click(within(coluna).getByRole('button', { name: 'Remover etapa Novo' }))
    expect(acoes.remover).not.toHaveBeenCalled()
  })
})
