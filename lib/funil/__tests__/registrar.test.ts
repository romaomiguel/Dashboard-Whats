import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarNoFunil } from '@/lib/funil/registrar'

const estado = vi.hoisted(() => ({
  etapas: [] as Record<string, unknown>[],
  linha: null as Record<string, unknown> | null,
  upserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  erroUpsert: null as { code: string; message: string } | null,
  erroUpdate: null as { code: string; message: string } | null,
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
        maybeSingle: async () => ({
          data: tabela === 'funil' ? estado.linha : null,
        }),
        upsert: async (valores: Record<string, unknown>) => {
          estado.upserts.push({ tabela, ...valores })
          return { data: null, error: estado.erroUpsert }
        },
        update: (valores: Record<string, unknown>) => {
          estado.updates.push({ tabela, ...valores })
          return { eq: () => ({ eq: async () => ({ error: estado.erroUpdate }) }) }
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
  estado.inserts = []
  estado.erroUpsert = null
  estado.erroUpdate = null
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

    espiao.mockRestore()
  })
})
