import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarMensagem } from '@/app/(app)/mensagens/actions'

const estado = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  // Linhas recentes de `mensagens`, como a busca real devolve: a ação filtra
  // em memória pela forma canônica do número, então o teste simula a lista
  // crua, não um resultado já filtrado.
  recentes: [] as Record<string, unknown>[],
  // Último `.limit(n)` pedido à busca de conexão. O mock recorta `recentes`
  // por ele: sem isso o teto da varredura não teria como ser testado, porque
  // o mock devolveria a lista inteira qualquer que fosse o limite.
  limiteBusca: null as number | null,
  // Cada gravação em `mensagens`, com as opções do upsert. As opções são o
  // que separa a gravação idempotente de um insert cru — sem elas a corrida
  // com o webhook volta a estourar 23505 na cara de quem enviou.
  gravacoes: [] as {
    valores: Record<string, unknown>
    opcoes?: Record<string, unknown>
  }[],
  erroGravacao: null as { code?: string; message?: string } | null,
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
        limit: (n: number) => {
          estado.limiteBusca = n
          return encadeado
        },
        // Thenable: `await` na query resolve para a lista, como o
        // `select().order().limit()` do Supabase de verdade (sem
        // `maybeSingle`, já que a ação não busca mais uma linha só). O
        // recorte honra o `.limit()` pedido, como o Postgres faria.
        then: (resolver: (r: { data: unknown; error: null }) => void) =>
          resolver({
            data: estado.recentes.slice(0, estado.limiteBusca ?? estado.recentes.length),
            error: null,
          }),
        upsert: async (
          valores: Record<string, unknown>,
          opcoes?: Record<string, unknown>,
        ) => {
          estado.gravacoes.push({ valores, opcoes })
          return { error: estado.erroGravacao }
        },
      }
      return encadeado
    },
  }),
}))

beforeEach(() => {
  estado.usuario = { id: 'user-1' }
  estado.limiteBusca = null
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
  estado.gravacoes = []
  estado.erroGravacao = null
  estado.envio = { key: { id: 'K-NOVA' } }
  estado.falhaEnvio = null
})

describe('enviarMensagem', () => {
  it('grava a saída com a chave devolvida pela Evolution', async () => {
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r).toEqual({ ok: true })
    expect(estado.gravacoes.at(-1)?.valores).toMatchObject({
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
    expect(estado.gravacoes).toHaveLength(0)
  })

  // 4096 é o limite da coluna e do próprio WhatsApp.
  it('recusa texto acima do limite', async () => {
    const r = await enviarMensagem('556584038479', 'x'.repeat(4097))
    expect(r.erro).toMatch(/longa/)
    expect(estado.gravacoes).toHaveLength(0)
  })

  it('recusa quando não há sessão', async () => {
    estado.usuario = null
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r.erro).toMatch(/Sessão expirada/)
    expect(estado.gravacoes).toHaveLength(0)
  })

  // Conversa sem histórico não diz por qual conexão responder, e chutar uma
  // mandaria do número errado.
  it('recusa conversa sem mensagem anterior', async () => {
    estado.recentes = []
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r.erro).toMatch(/conexão/i)
    expect(estado.gravacoes).toHaveLength(0)
  })

  // Falha de envio vira linha 'falhou' na conversa: sem isso a tela não
  // explicaria por que o contato não recebeu, como já acontece no disparo.
  it('grava a falha na conversa em vez de sumir com ela', async () => {
    estado.falhaEnvio = new Error('Evolution fora do ar')
    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r.erro).toBeTruthy()
    expect(estado.gravacoes.at(-1)?.valores).toMatchObject({
      direcao: 'saida',
      status: 'falhou',
      // Sem chave porque o envio nem chegou à Evolution. Precisa entrar
      // mesmo assim: o upsert conflita por `mensagem_key`, e vários NULL
      // continuam distintos entre si (migração 0011).
      mensagem_key: null,
    })
  })

  // A tela renderiza a thread a partir das mesmas linhas recentes que o
  // envio varre. Com o teto do envio menor que o da leitura, quem tem muito
  // tráfego abria a conversa, via o histórico, e o Enviar recusava.
  it('responde conversa cuja conexão está além das 200 linhas mais recentes', async () => {
    const enchimento = Array.from({ length: 950 }, (_, i) => ({
      instance_id: 'inst-de-outra-conversa',
      numero: String(5511900000000 + i),
      instances: { evolution_name: 'inst_ffffffff' },
    }))
    estado.recentes = [
      ...enchimento,
      {
        instance_id: 'inst-uuid',
        numero: '556584038479',
        instances: { evolution_name: 'inst_abcd1234' },
      },
    ]

    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r).toEqual({ ok: true })
    // A conexão certa, não a da conversa vizinha: responder pelo número
    // errado quebraria a conversa do lado do contato.
    expect(estado.gravacoes.at(-1)?.valores).toMatchObject({
      instance_id: 'inst-uuid',
    })
  })

  // O disparo grava com o nono dígito e o webhook grava sem ele; a mesma
  // pessoa aparece nas duas formas. Este teste só passa por causa de
  // `mesmoNumero`: com `===` a conversa ficaria sem conexão.
  it('acha a conexão quando o número guardado está sem o nono dígito', async () => {
    estado.recentes = [
      {
        instance_id: 'inst-uuid',
        numero: '556584038479', // como o webhook gravou
        instances: { evolution_name: 'inst_abcd1234' },
      },
    ]

    const r = await enviarMensagem('5565984038479', 'Olá') // como a tela pediu

    expect(r).toEqual({ ok: true })
    expect(estado.gravacoes.at(-1)?.valores).toMatchObject({
      instance_id: 'inst-uuid',
      // Grava a forma pedida, que é a que foi para a Evolution.
      numero: '5565984038479',
    })
  })

  // O webhook grava o eco `fromMe` desta mesma mensagem com a mesma chave e
  // pode chegar antes. Gravar por upsert é o que impede o 23505.
  it('grava a saída de forma idempotente, como o webhook faz', async () => {
    await enviarMensagem('556584038479', 'Olá')

    expect(estado.gravacoes.at(-1)?.opcoes).toEqual({
      onConflict: 'mensagem_key',
      ignoreDuplicates: true,
    })
  })

  // Perder a corrida para o webhook não é falha para quem enviou: a mensagem
  // saiu e a linha está na conversa. Devolver erro aqui fazia a tela manter o
  // texto digitado, e o segundo Enviar entregava a mensagem duas vezes.
  it('não vira erro quando a gravação acusa duplicidade', async () => {
    estado.erroGravacao = { code: '23505', message: 'duplicate key value' }

    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r).toEqual({ ok: true })
  })

  it('ainda avisa quando a gravação falha por outro motivo', async () => {
    estado.erroGravacao = { code: '08006', message: 'connection failure' }

    const r = await enviarMensagem('556584038479', 'Olá')

    expect(r.erro).toMatch(/não foi possível gravá-la/i)
  })
})
