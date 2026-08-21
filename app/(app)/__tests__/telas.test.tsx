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
    montar(<ListaConversas conversas={[]} />)
    expect(await screen.findByText('Lívia Torri')).toBeInTheDocument()
  })

  it('filtra pela busca', async () => {
    montar(<ListaConversas conversas={[]} />)
    await screen.findByText('Lívia Torri')

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Buscar conversa' }),
      'Helena',
    )

    expect(screen.getByText('Helena Duarte')).toBeInTheDocument()
    expect(screen.queryByText('Lívia Torri')).not.toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ListaConversas conversas={[]} />)
    expect(screen.getByText('Nenhuma conversa')).toBeInTheDocument()
  })

  // Os números de exemplo são fictícios: virar link abriria uma thread vazia
  // parecendo quebrada, então a linha de exemplo não pode ser clicável.
  it('a linha de exemplo não é um link', async () => {
    montar(<ListaConversas conversas={[]} />)
    await screen.findByText('Lívia Torri')
    expect(screen.queryByRole('link', { name: /Lívia Torri/ })).not.toBeInTheDocument()
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
    montar(<ListaDisparos etiquetas={[]} conexoes={[]} disparos={[]} />)
    expect(await screen.findByText('Promoção Black Friday')).toBeInTheDocument()
    // 1840 de 3200 entregues
    expect(screen.getByText('58%')).toBeInTheDocument()
  })

  it('mostra estado vazio quando o exemplo está desligado', async () => {
    await comExemploDesligado(<ListaDisparos etiquetas={[]} conexoes={[]} disparos={[]} />)
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
    montar(<ListaConversas conversas={[]} buscaInicial="Helena" />)
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

describe('conversas reais', () => {
  const base = {
    numero: '5565984627628',
    nome: 'Joana Prado',
    previa: 'Promoção de agosto!',
    quando: '2026-08-20T05:01:53.000Z',
    direcao: 'saida' as const,
    naoLidas: 0,
  }

  it('o disparo enviado aparece como conversa', async () => {
    montar(<ListaConversas conversas={[{ ...base, estado: 'enviada' as const }]} />)
    expect(await screen.findByText('Joana Prado')).toBeInTheDocument()
    expect(screen.getByText('Promoção de agosto!')).toBeInTheDocument()
    expect(screen.getByText('Enviada')).toBeInTheDocument()
  })

  it('envio que falhou se identifica como falha', async () => {
    montar(<ListaConversas conversas={[{ ...base, estado: 'falhou' as const }]} />)
    expect(await screen.findByText('Falhou')).toBeInTheDocument()
  })

  it('resposta recebida conta como não lida', async () => {
    montar(
      <ListaConversas
        conversas={[
          {
            ...base,
            direcao: 'entrada' as const,
            estado: 'respondeu' as const,
            naoLidas: 2,
          },
        ]}
      />,
    )
    expect(await screen.findByText('Respondeu')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  // O que o usuário pediu: depois de eu responder, deixa de ser "respondeu".
  it('depois de eu responder, a conversa vira respondida', async () => {
    montar(<ListaConversas conversas={[{ ...base, estado: 'respondida' as const }]} />)
    expect(await screen.findByText('Respondida')).toBeInTheDocument()
    expect(screen.queryByText('Respondeu')).not.toBeInTheDocument()
  })

  it('havendo conversa real, o exemplo some', async () => {
    montar(<ListaConversas conversas={[{ ...base, estado: 'enviada' as const }]} />)
    await screen.findByText('Joana Prado')
    expect(screen.queryByText('Lívia Torri')).not.toBeInTheDocument()
  })

  // A linha de uma conversa real leva à tela da conversa — sem isto, abrir a
  // thread a partir da lista fica quebrado silenciosamente.
  it('a linha da conversa é um link para a thread', async () => {
    montar(<ListaConversas conversas={[{ ...base, estado: 'enviada' as const }]} />)
    const link = await screen.findByRole('link', { name: /Joana Prado/ })
    expect(link).toHaveAttribute('href', '/mensagens/5565984627628')
  })
})

describe('filtro por estado', () => {
  const conversas = [
    {
      numero: '5565984627628',
      nome: 'Amanda',
      previa: 'X',
      quando: '2026-08-20T13:00:00.000Z',
      direcao: 'entrada' as const,
      estado: 'respondeu' as const,
      naoLidas: 1,
    },
    {
      numero: '5565984038479',
      nome: 'Matheus',
      previa: 'Teste',
      quando: '2026-08-20T12:00:00.000Z',
      direcao: 'saida' as const,
      estado: 'enviada' as const,
      naoLidas: 0,
    },
    {
      numero: '5511912345678',
      nome: 'Joana',
      previa: 'Obrigado',
      quando: '2026-08-20T11:00:00.000Z',
      direcao: 'saida' as const,
      estado: 'respondida' as const,
      naoLidas: 0,
    },
  ]

  it('conta cada estado a partir da lista inteira', async () => {
    montar(<ListaConversas conversas={conversas} />)
    expect(await screen.findByRole('button', { name: 'Todas (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Respondeu (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviada (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Respondida (1)' })).toBeInTheDocument()
  })

  it('filtrar deixa só quem está naquele estado', async () => {
    montar(<ListaConversas conversas={conversas} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Respondeu (1)' }))

    expect(screen.getByText('Amanda')).toBeInTheDocument()
    expect(screen.queryByText('Matheus')).not.toBeInTheDocument()
    expect(screen.queryByText('Joana')).not.toBeInTheDocument()
  })

  it('a busca continua valendo dentro do filtro', async () => {
    montar(<ListaConversas conversas={conversas} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Todas (3)' }))
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Buscar conversa' }),
      'Matheus',
    )

    expect(screen.getByText('Matheus')).toBeInTheDocument()
    expect(screen.queryByText('Amanda')).not.toBeInTheDocument()
  })

  it('não oferece filtro de estado que ninguém tem', async () => {
    montar(<ListaConversas conversas={conversas} />)
    await screen.findByText('Amanda')
    expect(screen.queryByRole('button', { name: /Falhou/ })).not.toBeInTheDocument()
  })
})

describe('resposta e o nono dígito', () => {
  // O disparo saiu para 5565984627628 e a resposta chegou de 556584627628 —
  // o WhatsApp devolve o número brasileiro sem o nono dígito. Antes disso
  // virava uma conversa nova e a original ficava parada em "enviada".
  it('a mais recente manda: respondida aparece como respondeu', async () => {
    montar(
      <ListaConversas
        conversas={[
          {
            numero: '556584627628',
            nome: 'Amanda',
            previa: 'X',
            quando: '2026-08-20T13:00:00.000Z',
            direcao: 'entrada' as const,
            estado: 'respondeu' as const,
            naoLidas: 1,
          },
        ]}
      />,
    )

    expect(await screen.findByText('Amanda')).toBeInTheDocument()
    expect(screen.getByText('Respondeu')).toBeInTheDocument()
    // Um card só, não dois.
    expect(screen.getAllByText('Amanda')).toHaveLength(1)
  })
})

describe('busca vinda da notificação, na forma canônica', () => {
  // O destino da notificação leva o número canônico (sem o nono dígito). Se a
  // última mensagem da conversa veio de um disparo, `m.chave` é o número do
  // cadastro, cru, com o nono dígito — sem comparar pela forma canônica dos
  // dois lados, o clique na notificação caía em "Nada encontrado".
  it('encontra a conversa mesmo com a última mensagem tendo o nono dígito', async () => {
    montar(
      <ListaConversas
        conversas={[
          {
            numero: '5565984627628',
            nome: 'Amanda',
            previa: 'Oi, tudo bem?',
            quando: '2026-08-20T13:00:00.000Z',
            direcao: 'entrada' as const,
            estado: 'respondeu' as const,
            naoLidas: 1,
          },
        ]}
        buscaInicial="556584627628"
      />,
    )

    expect(await screen.findByText('Amanda')).toBeInTheDocument()
  })
})
