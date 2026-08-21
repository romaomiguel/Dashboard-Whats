import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarMensagem } from '@/app/(app)/mensagens/actions'

const estado = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  // Linhas recentes de `mensagens`, como a busca real devolve: a ação filtra
  // em memória pela forma canônica do número, então o teste simula a lista
  // crua, não um resultado já filtrado.
  recentes: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  envio: { key: { id: 'K-NOVA' } } as unknown,
  falhaEnvio: null as Error | null,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/evolution/client', () => ({
  chamar: async () => {
    if (estado.falhaEnvio) throw estado.falhaEnvio
    return estado.envio
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
    from: () => {
      const encadeado = {
        select: () => encadeado,
        eq: () => encadeado,
        order: () => encadeado,
        limit: () => encadeado,
        // Thenable: `await` na query resolve para a lista, como o
        // `select().order().limit()` do Supabase de verdade (sem
        // `maybeSingle`, já que a ação não busca mais uma linha só).
        then: (resolver: (r: { data: unknown; error: null }) => void) =>
          resolver({ data: estado.recentes, error: null }),
        insert: async (valores: Record<string, unknown>) => {
          estado.inserts.push(valores)
          return { error: null }
        },
      }
      return encadeado
    },
  }),
}))

beforeEach(() => {
  estado.usuario = { id: 'user-1' }
  estado.recentes = [
    {
      instance_id: 'inst-uuid',
      numero: '556584038479',
      // Formato real exigido por validarNomeInstancia (inst_ + 8 hex);
      // um nome fora do formato cairia no catch do envio antes de chegar
      // à Evolution mockada, mascarando o teste de sucesso.
      instances: { evolution_name: 'inst_abcd1234', owner_id: 'user-1' },
    },
  ]
  estado.inserts = []
  estado.envio = { key: { id: 'K-NOVA' } }
  estado.falhaEnvio = null
})

describe('enviarMensagem', () => {
  it('grava a saída com a chave devolvida pela Evolution', async () => {
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r).toEqual({ ok: true })
    expect(estado.inserts.at(-1)).toMatchObject({
      owner_id: 'user-1',
      numero: '556584038479',
      direcao: 'saida',
      status: 'enviada',
      texto: 'Olá',
      // Sem a chave, o webhook não teria como marcar entregue e lida depois.
      mensagem_key: 'K-NOVA',
    })
  })

  it('recusa texto vazio sem falar com a Evolution', async () => {
    const r = await enviarMensagem('556584038479', '   ')

    expect(r.erro).toMatch(/Escreva/)
    expect(estado.inserts).toHaveLength(0)
  })

  // 4096 é o limite da coluna e do próprio WhatsApp.
  it('recusa texto acima do limite', async () => {
    const r = await enviarMensagem('556584038479', 'x'.repeat(4097))
    expect(r.erro).toMatch(/longa/)
    expect(estado.inserts).toHaveLength(0)
  })

  it('recusa quando não há sessão', async () => {
    estado.usuario = null
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r.erro).toMatch(/Sessão expirada/)
    expect(estado.inserts).toHaveLength(0)
  })

  // Conversa sem histórico não diz por qual conexão responder, e chutar uma
  // mandaria do número errado.
  it('recusa conversa sem mensagem anterior', async () => {
    estado.recentes = []
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r.erro).toMatch(/conexão/i)
    expect(estado.inserts).toHaveLength(0)
  })

  // Falha de envio vira linha 'falhou' na conversa: sem isso a tela não
  // explicaria por que o contato não recebeu, como já acontece no disparo.
  it('grava a falha na conversa em vez de sumir com ela', async () => {
    estado.falhaEnvio = new Error('Evolution fora do ar')
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r.erro).toBeTruthy()
    expect(estado.inserts.at(-1)).toMatchObject({
      direcao: 'saida',
      status: 'falhou',
    })
  })
})
