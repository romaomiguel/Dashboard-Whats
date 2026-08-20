import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHAVE_DADOS_EXEMPLO,
  DadosExemploProvider,
} from '@/components/dados-exemplo-provider'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { ListaExemplo } from '@/app/(app)/conexao/lista-exemplo'
import { ListaContatos } from '@/app/(app)/contatos/lista-contatos'
import { ListaDisparos } from '@/app/(app)/disparos/lista-disparos'
import { ListaConversas } from '@/app/(app)/mensagens/lista-conversas'
import { ListaMidias } from '@/app/(app)/midias/lista-midias'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

function montar(ui: React.ReactNode) {
  return render(<DadosExemploProvider>{ui}</DadosExemploProvider>)
}

/** Espera o provider terminar de ler o localStorage. */
async function comExemploDesligado(ui: React.ReactNode) {
  window.localStorage.setItem(CHAVE_DADOS_EXEMPLO, 'off')
  montar(ui)
  await screen.findByRole('button', { name: 'Restaurar exemplo' })
}

afterEach(() => {
  window.localStorage.clear()
})

describe('Conexão — cartões de amostra', () => {
  it('lista as instâncias de exemplo', async () => {
    montar(<ListaExemplo />)
    expect(await screen.findByText('Comercial 01')).toBeInTheDocument()
    expect(screen.getByText('3 de 4 instâncias online')).toBeInTheDocument()
  })

  it('some por inteiro quando o exemplo está desligado', async () => {
    window.localStorage.setItem(CHAVE_DADOS_EXEMPLO, 'off')
    montar(
      <>
        <SeloDadosExemplo />
        <ListaExemplo />
      </>,
    )
    await screen.findByRole('button', { name: 'Restaurar exemplo' })

    expect(screen.getByText('0 de 0 instâncias online')).toBeInTheDocument()
    expect(screen.queryByText('Comercial 01')).not.toBeInTheDocument()
  })
})

describe('Mensagens', () => {
  it('lista as conversas de exemplo', async () => {
    montar(<ListaConversas />)
    expect(await screen.findByText('Lívia Torri')).toBeInTheDocument()
  })

  it('filtra pela busca', async () => {
    montar(<ListaConversas />)
    await screen.findByText('Lívia Torri')

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Buscar conversa' }),
      'Helena',
    )

    expect(screen.getByText('Helena Duarte')).toBeInTheDocument()
    expect(screen.queryByText('Lívia Torri')).not.toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ListaConversas />)
    expect(screen.getByText('Nenhuma conversa')).toBeInTheDocument()
  })
})

describe('Contatos', () => {
  it('lista e filtra os contatos de exemplo', async () => {
    montar(<ListaContatos contatos={[]} etiquetas={[]} />)
    expect(await screen.findByText('Sofia Martins')).toBeInTheDocument()

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Buscar contato' }),
      'Bruno',
    )

    expect(screen.getByText('Bruno Alves')).toBeInTheDocument()
    expect(screen.queryByText('Sofia Martins')).not.toBeInTheDocument()
  })

  it('exclui um contato da lista', async () => {
    montar(<ListaContatos contatos={[]} etiquetas={[]} />)
    await screen.findByText('Bruno Alves')

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Bruno Alves' }),
    )

    expect(screen.queryByText('Bruno Alves')).not.toBeInTheDocument()
  })

  it('exclui em lote o que estiver selecionado', async () => {
    montar(<ListaContatos contatos={[]} etiquetas={[]} />)
    await screen.findByText('Lívia Torri')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }))
    await userEvent.click(screen.getByRole('button', { name: /^Excluir \(8\)$/ }))

    expect(screen.getByText('Nenhum contato')).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ListaContatos contatos={[]} etiquetas={[]} />)
    expect(screen.getByText('Nenhum contato')).toBeInTheDocument()
  })
})

describe('Disparos', () => {
  it('mostra o progresso de cada campanha', async () => {
    montar(<ListaDisparos etiquetas={[]} conexoes={[]} />)
    expect(await screen.findByText('Promoção Black Friday')).toBeInTheDocument()
    // 1840 de 3200 entregues
    expect(screen.getByText('58%')).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ListaDisparos etiquetas={[]} conexoes={[]} />)
    expect(screen.getByText('Nenhuma campanha')).toBeInTheDocument()
  })
})

describe('Mídias', () => {
  it('lista os arquivos de exemplo', async () => {
    montar(<ListaMidias midias={[]} />)
    expect(await screen.findByText('catalogo-2026.pdf')).toBeInTheDocument()
    expect(
      screen.getByText('6 arquivos de exemplo na biblioteca'),
    ).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ListaMidias midias={[]} />)
    expect(screen.getByText('Biblioteca vazia')).toBeInTheDocument()
  })
})

describe('busca vinda da topbar', () => {
  it('Contatos já abre filtrado pelo termo da URL', async () => {
    montar(<ListaContatos contatos={[]} etiquetas={[]} buscaInicial="Sofia" />)
    expect(await screen.findByText('Sofia Martins')).toBeInTheDocument()
    expect(screen.queryByText('Lívia Torri')).not.toBeInTheDocument()
  })

  it('Mensagens já abre filtrada pelo termo da URL', async () => {
    montar(<ListaConversas buscaInicial="Helena" />)
    expect(await screen.findByText('Helena Duarte')).toBeInTheDocument()
    expect(screen.queryByText('Rafael Nunes')).not.toBeInTheDocument()
  })
})

describe('etiquetas do usuário', () => {
  it('a etiqueta cadastrada manda na cor do selo', async () => {
    montar(
      <ListaContatos
        contatos={[]}
        etiquetas={[{ id: '1', nome: 'VIP', cor: 'roxo' }]}
        buscaInicial="Lívia"
      />,
    )
    const selo = await screen.findByText('VIP')
    expect(selo.className).toContain('violet')
  })
})

describe('contatos salvos', () => {
  const salvos = [
    {
      id: 'c1',
      nome: 'Joana Prado',
      numero: '+55 11 90000-0000',
      etiqueta: 'VIP',
      criadoEm: '2026-08-19T12:00:00.000Z',
    },
  ]

  it('assim que existe contato real, o exemplo some da lista', async () => {
    montar(<ListaContatos contatos={salvos} etiquetas={[]} />)
    expect(await screen.findByText('Joana Prado')).toBeInTheDocument()
    expect(screen.queryByText('Lívia Torri')).not.toBeInTheDocument()
    expect(screen.getByText('contatos no total')).toBeInTheDocument()
  })

  it('sem contato real, a lista se identifica como exemplo', async () => {
    montar(<ListaContatos contatos={[]} etiquetas={[]} />)
    expect(await screen.findByText('Lívia Torri')).toBeInTheDocument()
    expect(screen.getByText('contatos de exemplo')).toBeInTheDocument()
  })

  it('contato sem etiqueta diz isso, em vez de inventar uma', async () => {
    montar(
      <ListaContatos
        contatos={[{ ...salvos[0], etiqueta: null }]}
        etiquetas={[]}
      />,
    )
    expect(await screen.findByText('sem etiqueta')).toBeInTheDocument()
  })
})

describe('mídias salvas', () => {
  const salvas = [
    {
      id: 'm1',
      nome: 'contrato.pdf',
      tipo: 'documento' as const,
      tamanho: 2_400_000,
      legenda: null,
      criadoEm: '2026-08-20T10:00:00.000Z',
    },
  ]

  it('assim que existe mídia real, o exemplo some da grade', async () => {
    montar(<ListaMidias midias={salvas} />)
    expect(await screen.findByText('contrato.pdf')).toBeInTheDocument()
    expect(screen.queryByText('catalogo-2026.pdf')).not.toBeInTheDocument()
  })

  it('mostra o tamanho legível, não o número de bytes', async () => {
    montar(<ListaMidias midias={salvas} />)
    expect(await screen.findByText('2,3 MB')).toBeInTheDocument()
  })

  it('só a mídia real oferece exclusão; a de exemplo não', async () => {
    montar(<ListaMidias midias={salvas} />)
    expect(
      await screen.findByRole('button', { name: 'Excluir contrato.pdf' }),
    ).toBeInTheDocument()
  })
})
