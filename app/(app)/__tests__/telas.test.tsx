import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHAVE_DADOS_EXEMPLO,
  DadosExemploProvider,
} from '@/components/dados-exemplo-provider'
import ConexaoPage from '@/app/(app)/conexao/page'
import ContatosPage from '@/app/(app)/contatos/page'
import DisparosPage from '@/app/(app)/disparos/page'
import MensagensPage from '@/app/(app)/mensagens/page'
import MidiasPage from '@/app/(app)/midias/page'

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

describe('Conexão', () => {
  it('lista as instâncias de exemplo', async () => {
    montar(<ConexaoPage />)
    expect(await screen.findByText('Comercial 01')).toBeInTheDocument()
    expect(screen.getByText('3 de 4 instâncias online')).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ConexaoPage />)
    expect(screen.getByText('Nenhuma conexão')).toBeInTheDocument()
    expect(screen.getByText('0 de 0 instâncias online')).toBeInTheDocument()
    expect(screen.queryByText('Comercial 01')).not.toBeInTheDocument()
  })

  it('oferece o diálogo de nova conexão', async () => {
    montar(<ConexaoPage />)
    expect(
      await screen.findByRole('button', { name: /Nova conexão/ }),
    ).toBeInTheDocument()
  })
})

describe('Mensagens', () => {
  it('lista as conversas de exemplo', async () => {
    montar(<MensagensPage />)
    expect(await screen.findByText('Lívia Torri')).toBeInTheDocument()
  })

  it('filtra pela busca', async () => {
    montar(<MensagensPage />)
    await screen.findByText('Lívia Torri')

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Buscar conversa' }),
      'Helena',
    )

    expect(screen.getByText('Helena Duarte')).toBeInTheDocument()
    expect(screen.queryByText('Lívia Torri')).not.toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<MensagensPage />)
    expect(screen.getByText('Nenhuma conversa')).toBeInTheDocument()
  })
})

describe('Contatos', () => {
  it('lista e filtra os contatos de exemplo', async () => {
    montar(<ContatosPage />)
    expect(await screen.findByText('Sofia Martins')).toBeInTheDocument()

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Buscar contato' }),
      'Bruno',
    )

    expect(screen.getByText('Bruno Alves')).toBeInTheDocument()
    expect(screen.queryByText('Sofia Martins')).not.toBeInTheDocument()
  })

  it('exclui um contato da lista', async () => {
    montar(<ContatosPage />)
    await screen.findByText('Bruno Alves')

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir Bruno Alves' }),
    )

    expect(screen.queryByText('Bruno Alves')).not.toBeInTheDocument()
  })

  it('exclui em lote o que estiver selecionado', async () => {
    montar(<ContatosPage />)
    await screen.findByText('Lívia Torri')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }))
    await userEvent.click(screen.getByRole('button', { name: /^Excluir \(8\)$/ }))

    expect(screen.getByText('Nenhum contato')).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ContatosPage />)
    expect(screen.getByText('Nenhum contato')).toBeInTheDocument()
  })
})

describe('Disparos', () => {
  it('mostra o progresso de cada campanha', async () => {
    montar(<DisparosPage />)
    expect(await screen.findByText('Promoção Black Friday')).toBeInTheDocument()
    // 1840 de 3200 entregues
    expect(screen.getByText('58%')).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<DisparosPage />)
    expect(screen.getByText('Nenhuma campanha')).toBeInTheDocument()
  })
})

describe('Mídias', () => {
  it('lista os arquivos de exemplo', async () => {
    montar(<MidiasPage />)
    expect(await screen.findByText('catalogo-2026.pdf')).toBeInTheDocument()
    expect(screen.getByText('6 arquivos na biblioteca de mídias')).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<MidiasPage />)
    expect(screen.getByText('Biblioteca vazia')).toBeInTheDocument()
  })
})
