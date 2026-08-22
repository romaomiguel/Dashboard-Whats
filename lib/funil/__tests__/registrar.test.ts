import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarNoFunil } from '@/lib/funil/registrar'

const estado = vi.hoisted(() => ({
  etapas: [] as Record<string, unknown>[],
  linha: null as Record<string, unknown> | null,
  upserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  // Os filtros de cada update, na mesma ordem de `updates`: é por eles que
  // se prova que a promoção sai com a condição de compare-and-swap.
  filtrosDoUpdate: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  erroUpsert: null as { code: string; message: string } | null,
  erroUpdate: null as { code: string; message: string } | null,
  // Linha que passa a valer no "banco" logo depois da leitura: é assim que
  // este falso reproduz um arraste manual caindo entre ler e escrever.
  arrasteDepoisDaLeitura: null as Record<string, unknown> | null,
}))

function clienteFalso() {
  return {
    from: (tabela: string) => {
      const registro: Record<string, unknown> = { tabela }
      const encadeado = {
        select: () => encadeado,
        eq: (coluna: string, valor: unknown) => {
          registro[coluna] = valor
          return encadeado
        },
        not: () => encadeado,
        maybeSingle: async () => {
          const vista = tabela === 'funil' ? estado.linha : null
          // A corrida do achado 3 acontece exatamente aqui: quem chamou já
          // leu, e o arraste do usuário grava antes do update sair. Trocar o
          // estado neste ponto é o jeito honesto de reproduzir isso sem banco.
          if (tabela === 'funil' && estado.arrasteDepoisDaLeitura) {
            estado.linha = estado.arrasteDepoisDaLeitura
            estado.arrasteDepoisDaLeitura = null
          }
          return { data: vista }
        },
        upsert: async (valores: Record<string, unknown>) => {
          estado.upserts.push({ tabela, ...valores })
          return { data: null, error: estado.erroUpsert }
        },
        update: (valores: Record<string, unknown>) => {
          estado.updates.push({ tabela, ...valores })
          // Mesma referência que vai para o estado: os `.eq` a preenchem.
          const filtros: Record<string, unknown> = {}
          estado.filtrosDoUpdate.push(filtros)

          const escrita = {
            eq: (coluna: string, valor: unknown) => {
              filtros[coluna] = valor
              return escrita
            },
            // `.select()` faz o PostgREST devolver as linhas afetadas. O
            // falso aplica os filtros contra o estado **atual** para que o
            // compare-and-swap possa de fato não casar. Filtro ausente é
            // filtro que não restringe — é isso que faz o teste da corrida
            // falhar de verdade se o `.eq('etapa_id')` sumir, em vez de
            // passar por acidente. `owner_id` não restringe nada porque a
            // linha de mentira não tem dono.
            select: async () => {
              if (estado.erroUpdate) return { data: null, error: estado.erroUpdate }
              const linha = estado.linha
              const casou =
                linha !== null &&
                (filtros.id === undefined || filtros.id === linha.id) &&
                (filtros.etapa_id === undefined || filtros.etapa_id === linha.etapa_id)
              return { data: casou ? [{ id: linha!.id }] : [], error: null }
            },
          }
          return escrita
        },
        insert: async (valores: Record<string, unknown>) => {
          estado.inserts.push({ tabela, ...valores })
          return { error: null }
        },
        then: (r: (v: { data: unknown; error: null }) => void) =>
          r({ data: tabela === 'etapas' ? estado.etapas : [], error: null }),
      }
      return encadeado
    },
  }
}

beforeEach(() => {
  estado.etapas = [
    { id: 'e-novo', nome: 'Novo', papel: 'entrada' },
    { id: 'e-conversa', nome: 'Em conversa', papel: 'respondeu' },
  ]
  estado.linha = null
  estado.upserts = []
  estado.updates = []
  estado.filtrosDoUpdate = []
  estado.inserts = []
  estado.erroUpsert = null
  estado.erroUpdate = null
  estado.arrasteDepoisDaLeitura = null
})

describe('registrarNoFunil', () => {
  it('inscreve conversa nova na etapa de entrada', async () => {
    await registrarNoFunil(clienteFalso() as never, {
      ownerId: 'user-1',
      numero: '5565984038479',
      direcao: 'saida',
    })

    expect(estado.upserts.at(-1)).toMatchObject({
      tabela: 'funil',
      owner_id: 'user-1',
      // Guardado na forma canônica: é o que faz a resposta sem o nono
      // dígito cair na mesma linha do disparo que a criou.
      chave_numero: '556584038479',
      numero: '5565984038479',
      etapa_id: 'e-novo',
    })
  })

  it('promove quem respondeu e historia como automático', async () => {
    estado.linha = { id: 'f1', etapa_id: 'e-novo', etapas: { nome: 'Novo' } }

    await registrarNoFunil(clienteFalso() as never, {
      ownerId: 'user-1',
      numero: '556584038479',
      direcao: 'entrada',
    })

    expect(estado.updates.at(-1)).toMatchObject({ tabela: 'funil', etapa_id: 'e-conversa' })
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'funil_historico',
      funil_id: 'f1',
      de: 'Novo',
      para: 'Em conversa',
      automatico: true,
    })
  })

  it('não toca em quem já passou da entrada', async () => {
    estado.linha = { id: 'f1', etapa_id: 'e-negociando', etapas: { nome: 'Negociando' } }

    await registrarNoFunil(clienteFalso() as never, {
      ownerId: 'user-1',
      numero: '556584038479',
      direcao: 'entrada',
    })

    expect(estado.updates).toHaveLength(0)
    expect(estado.inserts).toHaveLength(0)
  })

  it('fica quieto quando nenhuma etapa tem papel', async () => {
    estado.etapas = [{ id: 'e1', nome: 'Qualquer', papel: null }]

    await registrarNoFunil(clienteFalso() as never, {
      ownerId: 'user-1',
      numero: '556584038479',
      direcao: 'entrada',
    })

    expect(estado.upserts).toHaveLength(0)
    expect(estado.updates).toHaveLength(0)
  })

  // O webhook existe para gravar mensagem. Perder uma promoção de etapa é
  // menos grave que derrubar a requisição e perder a mensagem inteira.
  it('engole o erro de gravação em vez de estourar', async () => {
    estado.erroUpsert = { code: '23505', message: 'duplicado' }

    await expect(
      registrarNoFunil(clienteFalso() as never, {
        ownerId: 'user-1',
        numero: '556584038479',
        direcao: 'saida',
      }),
    ).resolves.toBeUndefined()
  })

  // Achado da revisão: o update do caminho de promoção descartava o erro
  // sem log nenhum — a única mutação do arquivo que fazia isso. Contradizia
  // o próprio contrato da função (falha vira log, nunca exceção) e o padrão
  // já seguido pelo upsert e pelo insert do histórico logo abaixo dele.
  it('loga quando o update da promoção falha, sem estourar', async () => {
    estado.linha = { id: 'f1', etapa_id: 'e-novo', etapas: { nome: 'Novo' } }
    estado.erroUpdate = { code: '40001', message: 'conflito de serialização' }
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      registrarNoFunil(clienteFalso() as never, {
        ownerId: 'user-1',
        numero: '556584038479',
        direcao: 'entrada',
      }),
    ).resolves.toBeUndefined()

    expect(espiao).toHaveBeenCalledWith('[funil] não promoveu:', '40001', 'conflito de serialização')
    // Achado da revisão: o log não interrompia nada e o histórico era gravado
    // logo abaixo, jurando "Novo → Em conversa" para uma promoção que não
    // aconteceu. O card fica em "Novo" e a linha do tempo diz o contrário —
    // a história falsa que `automatico` existe para não contar.
    expect(estado.inserts).toHaveLength(0)

    espiao.mockRestore()
  })

  // Achado da revisão: leitura e escrita não eram um compare-and-swap. Com o
  // filtro só por id, a promoção que já estava em voo puxava de volta um card
  // que o usuário tinha acabado de arrastar para outra coluna — exatamente o
  // que a seção 3 do design promete que nunca acontece.
  it('não desfaz o arraste manual que caiu entre a leitura e a escrita', async () => {
    estado.linha = { id: 'f1', etapa_id: 'e-novo', etapas: { nome: 'Novo' } }
    // O usuário arrasta para "Negociando" depois que esta execução já leu.
    estado.arrasteDepoisDaLeitura = {
      id: 'f1',
      etapa_id: 'e-negociando',
      etapas: { nome: 'Negociando' },
    }

    await registrarNoFunil(clienteFalso() as never, {
      ownerId: 'user-1',
      numero: '556584038479',
      direcao: 'entrada',
    })

    // O update saiu condicionado à etapa lida — e por isso não casou com
    // nenhuma linha.
    expect(estado.filtrosDoUpdate.at(-1)).toMatchObject({ id: 'f1', etapa_id: 'e-novo' })
    // Nada mudou no funil, então nada foi historiado: o card continua em
    // "Negociando", onde o usuário o pôs.
    expect(estado.inserts).toHaveLength(0)
  })
})
