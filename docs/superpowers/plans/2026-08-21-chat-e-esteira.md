# Chat e Esteira de Leads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir a conversa dentro do CRM — ler a thread e responder pela plataforma — e organizar os contatos numa esteira de etapas com histórico de movimentação.

**Architecture:** O caminho de envio e o de recebimento já existem e são reaproveitados inteiros: o disparo já fala com a Evolution por `endpoints.mensagem.texto`, e o webhook já grava o que entra em `public.mensagens`. Falta a leitura de uma conversa só (hoje `listarConversas` devolve uma linha por contato, sem histórico), uma ação de envio avulso, e a tela de thread. A esteira entra depois, como tabela de etapas ordenadas mais o vínculo do contato, separada de `etiquetas` — etiqueta classifica, etapa posiciona no funil e guarda por onde passou.

**Tech Stack:** Next.js 16.3 (App Router), TypeScript, Supabase (Postgres + RLS + Realtime), Vitest + Testing Library.

**Spec:** `implementation.txt`, item 2 — "permitir responder mensagens diretamente pela plataforma e organizar os contatos em uma esteira, classificando-os por nível de interesse e engajamento". A classificação por interesse/engajamento **não** está aqui: ela depende de métricas de interação e é o plano `2026-08-21-inteligencia-clientes.md`. Esta esteira é posicionamento manual.

## Global Constraints

- **Comentários em português**, explicando *por que*, no estilo do repo. Nunca comentar o óbvio.
- **TDD**: teste falhando antes da implementação. A suíte hoje tem 327 testes em 31 arquivos e termina verde a cada task.
- **`npx tsc --noEmit` limpo** ao fim de cada task.
- **Ler `node_modules/next/dist/docs/`** antes de mexer em rota, página ou server action — o `AGENTS.md` exige, porque esta versão do Next tem quebras em relação ao conhecimento pré-treinado.
- **Numeração de migration:** este plano ocupa **0014 e 0015**. O `2026-08-21-plano-futuro.md` reservava a 0014 para a coluna `provedor`; quando aquele plano for executado, ele passa a usar o número livre seguinte.
- **Agrupamento de número sempre por `chaveDoNumero`** (`lib/numeros.ts`). O disparo grava com o nono dígito e o webhook sem ele; comparar cru separa a mesma pessoa em duas conversas.
- **RLS por `owner_id`** em toda tabela nova, no padrão das existentes.
- Commits frequentes, um por task, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Decisões já tomadas (não reabrir)

1. **Etapa não é etiqueta.** `etiquetas` já existe e classifica o contato livremente (várias leituras possíveis, sem ordem). Etapa é posição ordenada no funil, uma por contato, com histórico. Forçar as duas na mesma tabela tornaria impossível responder "quanto tempo ficou em Negociação".
2. **A thread é rota própria** (`/mensagens/[numero]`), não painel lateral. A URL precisa ser compartilhável e o `destino` das notificações já aponta para `/mensagens?busca=…` — a Task 3 troca esse destino pela rota da conversa.
3. **Envio avulso reusa a instância da própria conversa**, lida da última mensagem dela. Um usuário pode ter várias conexões, e responder pelo número errado quebraria a conversa do lado do contato.
4. **Sem realtime otimista na thread:** a mensagem enviada só aparece depois que o servidor confirmou. Mensagem que parece enviada e não foi é pior que meio segundo de espera.

---

## Estrutura de arquivos

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0014_esteira.sql` | Tabela `etapas`, `contatos.etapa_id`, `contato_etapa_historico` |
| `lib/consultas/conversa.ts` | `listarMensagensDaConversa(numero)` |
| `app/(app)/mensagens/[numero]/page.tsx` | Rota da thread |
| `app/(app)/mensagens/[numero]/thread.tsx` | Balões, composição, Realtime |
| `app/(app)/mensagens/actions.ts` | `enviarMensagem(numero, texto)` |
| `lib/esteira.ts` | Domínio puro da esteira (ordem, validação) |
| `lib/consultas/esteira.ts` | `listarEsteira()` |
| `app/(app)/esteira/page.tsx` | Tela do funil |
| `app/(app)/esteira/quadro.tsx` | Colunas por etapa |
| `app/(app)/esteira/actions.ts` | `moverContato`, `criarEtapa`, `renomearEtapa`, `removerEtapa` |

**Modificados:** `lib/notificacoes.ts` (destino da notificação de mensagem), `components/sidebar.tsx` (item Esteira).

---

### Task 1: Ler uma conversa

**Files:**
- Create: `lib/consultas/conversa.ts`
- Test: `lib/__tests__/conversa.test.ts`

**Interfaces:**
- Consumes: `chaveDoNumero` de `@/lib/numeros`; `criarClienteServidor`.
- Produces: `type MensagemDaConversa = { id, direcao, status, texto, quando, erro }`, `listarMensagensDaConversa(numero: string): Promise<MensagemDaConversa[]>`, e a função pura `mesmaConversa(a: string, b: string): boolean`.

O filtro não pode ir para o Postgres como `eq('numero', numero)`: as linhas da mesma pessoa estão gravadas em duas formas. A seleção traz o histórico do dono e filtra em memória pela chave canônica, no mesmo espírito de `listarConversas`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/__tests__/conversa.test.ts
import { describe, expect, it } from 'vitest'
import { mesmaConversa, ordenarCronologico } from '@/lib/consultas/conversa'

describe('mesmaConversa', () => {
  // O disparo grava 5565984038479 e o webhook devolve 556584038479: é a
  // mesma pessoa, e comparar cru abriria duas threads.
  it('junta as duas formas do número brasileiro', () => {
    expect(mesmaConversa('5565984038479', '556584038479')).toBe(true)
  })

  it('separa pessoas diferentes', () => {
    expect(mesmaConversa('5565984038479', '5511999998888')).toBe(false)
  })

  it('ignora formatação', () => {
    expect(mesmaConversa('+55 (65) 98403-8479', '5565984038479')).toBe(true)
  })
})

describe('ordenarCronologico', () => {
  // A thread lê de cima para baixo, ao contrário da lista de conversas, que
  // mostra a mais nova primeiro.
  it('põe a mais antiga primeiro', () => {
    const linhas = [
      { id: 'b', quando: '2026-08-21T10:00:00.000Z' },
      { id: 'a', quando: '2026-08-21T09:00:00.000Z' },
      { id: 'c', quando: '2026-08-21T11:00:00.000Z' },
    ]
    expect(ordenarCronologico(linhas).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('não explode com lista vazia', () => {
    expect(ordenarCronologico([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/__tests__/conversa.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/consultas/conversa"`

- [ ] **Step 3: Implementar**

```ts
// lib/consultas/conversa.ts
import { chaveDoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type MensagemDaConversa = {
  id: string
  direcao: 'saida' | 'entrada'
  status: string
  texto: string
  quando: string
  erro: string | null
}

/** Verdadeiro quando os dois números endereçam a mesma conversa. */
export function mesmaConversa(a: string, b: string): boolean {
  return chaveDoNumero(a) === chaveDoNumero(b)
}

/** A thread lê de cima para baixo; a lista de conversas é que inverte. */
export function ordenarCronologico<T extends { quando: string }>(linhas: T[]): T[] {
  return [...linhas].sort((x, y) => x.quando.localeCompare(y.quando))
}

/** Teto por conversa: acima disto a tela vira rolagem infinita sem utilidade. */
const LIMITE_THREAD = 200

/**
 * Histórico de uma conversa só.
 *
 * O filtro por número acontece em memória, não no Postgres: as linhas da
 * mesma pessoa podem estar gravadas com e sem o nono dígito, e `eq('numero')`
 * traria metade da conversa. O recorte de dono fica com a RLS.
 */
export async function listarMensagensDaConversa(
  numero: string,
): Promise<MensagemDaConversa[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('mensagens')
    .select('id, direcao, status, texto, erro, criado_em')
    .order('criado_em', { ascending: false })
    .limit(1000)

  if (error || !data) return []

  const desta = data.filter((linha) =>
    mesmaConversa(String((linha as { numero?: string }).numero ?? numero), numero),
  )

  return ordenarCronologico(
    desta.slice(0, LIMITE_THREAD).map((linha) => ({
      id: String(linha.id),
      direcao: String(linha.direcao) as MensagemDaConversa['direcao'],
      status: String(linha.status),
      texto: String(linha.texto),
      quando: String(linha.criado_em),
      erro: linha.erro ? String(linha.erro) : null,
    })),
  )
}
```

> **Atenção ao executar:** o `select` acima precisa incluir `numero`, senão o filtro em memória não tem o que comparar. Acrescente `numero` à lista de colunas e ajuste o `map`. O teste da Task 1 não pega isso (só cobre as funções puras) — a Task 3 pega, ao renderizar a thread.

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/__tests__/conversa.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/consultas/conversa.ts lib/__tests__/conversa.test.ts
git commit -m "feat(conversa): leitura do histórico de uma conversa"
```

---

### Task 2: Responder pela plataforma

**Files:**
- Create: `app/(app)/mensagens/actions.ts`
- Test: `app/(app)/mensagens/__tests__/actions.test.ts`
- Read: `lib/disparos/processador.ts:70-110` (formato do envio, confirmado contra a 2.3.7)

**Interfaces:**
- Consumes: `chamar` de `@/lib/evolution/client`, `endpoints` de `@/lib/evolution/endpoints`.
- Produces: `type EstadoEnvio = { erro?: string; ok?: boolean }`, `enviarMensagem(numero: string, texto: string): Promise<EstadoEnvio>`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// app/(app)/mensagens/__tests__/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarMensagem } from '@/app/(app)/mensagens/actions'

const estado = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  ultimaMensagem: null as Record<string, unknown> | null,
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
        maybeSingle: async () => ({ data: estado.ultimaMensagem }),
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
  estado.ultimaMensagem = {
    instance_id: 'inst-uuid',
    numero: '556584038479',
    instances: { evolution_name: 'inst_abc', owner_id: 'user-1' },
  }
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
    estado.ultimaMensagem = null
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/mensagens/__tests__/actions.test.ts'`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// app/(app)/mensagens/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { chamar } from '@/lib/evolution/client'
import { endpoints } from '@/lib/evolution/endpoints'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoEnvio = { erro?: string; ok?: boolean }

/** Limite da coluna `mensagens.texto` e do próprio WhatsApp. */
const LIMITE_TEXTO = 4096

/**
 * Responde um contato pela plataforma.
 *
 * A conexão sai da última mensagem da conversa, e não de "a primeira conexão
 * do usuário": com duas conexões, responder pelo número errado quebraria a
 * conversa do lado do contato, que veria a resposta vindo de um
 * desconhecido.
 */
export async function enviarMensagem(
  numero: string,
  texto: string,
): Promise<EstadoEnvio> {
  const limpo = texto.trim()
  if (!limpo) return { erro: 'Escreva alguma coisa antes de enviar.' }
  if (limpo.length > LIMITE_TEXTO) {
    return { erro: `Mensagem muito longa: o limite é ${LIMITE_TEXTO} caracteres.` }
  }

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: ultima } = await supabase
    .from('mensagens')
    .select('instance_id, numero, instances(evolution_name)')
    .eq('numero', numero)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  const instancia = (ultima as { instances?: { evolution_name?: string } } | null)
    ?.instances

  if (!ultima || !instancia?.evolution_name) {
    return {
      erro: 'Não dá para saber por qual conexão responder esta conversa. Abra a conversa a partir de uma mensagem recebida.',
    }
  }

  let chave: string | null = null
  let erroEnvio: string | null = null

  try {
    const resposta = await chamar<{ key?: { id?: string } }>(
      endpoints.mensagem.texto(String(instancia.evolution_name)),
      { metodo: 'POST', corpo: { number: numero, text: limpo } },
    )
    // Guardar o id é o que permite ao webhook marcar entregue e lida depois.
    chave = resposta?.key?.id ?? null
  } catch (causa) {
    erroEnvio = causa instanceof Error ? causa.message : 'erro desconhecido'
    console.error('[conversa] envio falhou:', numero, erroEnvio)
  }

  // Grava mesmo falhando, como o disparo já faz: sem a linha, a tela não
  // explicaria por que o contato não recebeu nada.
  const { error } = await supabase.from('mensagens').insert({
    owner_id: user.id,
    instance_id: (ultima as { instance_id?: string }).instance_id,
    numero,
    direcao: 'saida',
    status: erroEnvio ? 'falhou' : 'enviada',
    texto: limpo,
    erro: erroEnvio ? erroEnvio.slice(0, 300) : null,
    mensagem_key: chave,
  })

  if (error) return { erro: 'A mensagem saiu, mas não foi possível gravá-la.' }

  revalidatePath(`/mensagens/${numero}`)
  revalidatePath('/mensagens')

  if (erroEnvio) {
    return { erro: 'Não foi possível entregar a mensagem. Ela ficou marcada como falhou na conversa.' }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/mensagens/__tests__/actions.test.ts'`
Expected: PASS (6 testes)

- [ ] **Step 5: Typecheck e suíte**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 6: Commit**

```bash
git add 'app/(app)/mensagens/'
git commit -m "feat(conversa): responder o contato pela plataforma"
```

---

### Task 3: Tela da conversa

**Files:**
- Create: `app/(app)/mensagens/[numero]/page.tsx`
- Create: `app/(app)/mensagens/[numero]/thread.tsx`
- Modify: `lib/notificacoes.ts` (destino da notificação de mensagem)
- Modify: `app/(app)/mensagens/lista-conversas.tsx` (linha vira link)
- Test: `app/(app)/mensagens/__tests__/thread.test.tsx`
- Read first: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`

**Interfaces:**
- Consumes: `MensagemDaConversa` (Task 1), `enviarMensagem` (Task 2).
- Produces: componente `Thread({ numero, nome, iniciais }: { numero: string; nome: string; iniciais: MensagemDaConversa[] })`.

- [ ] **Step 1: Ler a doc de páginas desta versão do Next**

Run: `sed -n '1,60p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`

Confirmar a forma de `params` (nesta versão é `Promise<...>`, como nas rotas já existentes).

- [ ] **Step 2: Escrever o teste falhando**

```tsx
// app/(app)/mensagens/__tests__/thread.test.tsx
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
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/mensagens/__tests__/thread.test.tsx'`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar o componente**

```tsx
// app/(app)/mensagens/[numero]/thread.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { enviarMensagem } from '@/app/(app)/mensagens/actions'
import { Button } from '@/components/ui/button'
import { formatarDataHora } from '@/lib/datas'
import type { MensagemDaConversa } from '@/lib/consultas/conversa'
import { criarClienteNavegador } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/** Junta os eventos de uma rajada num só refresh, como o sino já faz. */
const ATRASO_REFRESH_MS = 700

export function Thread({
  numero,
  nome,
  iniciais,
}: {
  numero: string
  nome: string
  iniciais: MensagemDaConversa[]
}) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Realtime: mensagem nova do contato entra sem recarregar. O filtro por
  // owner não cabe aqui (a tabela não expõe owner no payload do canal), então
  // o refresh é do servidor, que já aplica RLS.
  useEffect(() => {
    const supabase = criarClienteNavegador()
    let temporizador: ReturnType<typeof setTimeout> | null = null

    const canal = supabase
      .channel(`conversa:${numero}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensagens' },
        () => {
          if (temporizador) clearTimeout(temporizador)
          temporizador = setTimeout(() => {
            temporizador = null
            router.refresh()
          }, ATRASO_REFRESH_MS)
        },
      )
      .subscribe()

    return () => {
      if (temporizador) clearTimeout(temporizador)
      supabase.removeChannel(canal)
    }
  }, [numero, router])

  async function enviar() {
    const limpo = texto.trim()
    if (!limpo || enviando) return

    setErro('')
    setEnviando(true)
    const resultado = await enviarMensagem(numero, limpo)
    setEnviando(false)

    if (resultado.erro) {
      // O texto fica: perder o que a pessoa escreveu por causa de uma falha
      // de rede é pior que repetir o erro na tela.
      setErro(resultado.erro)
      return
    }

    setTexto('')
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-lg font-semibold text-foreground">{nome}</h1>

      {iniciais.length === 0 ? (
        <p className="flex-1 text-sm text-muted-foreground">
          Nenhuma mensagem nesta conversa ainda.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {iniciais.map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[75%] rounded-lg px-3 py-2',
                m.direcao === 'saida'
                  ? 'self-end bg-primary/10'
                  : 'self-start bg-muted',
              )}
            >
              <p className="whitespace-pre-wrap text-sm text-foreground">{m.texto}</p>
              <span className="text-[11px] text-muted-foreground">
                {formatarDataHora(m.quando)}
                {m.status === 'falhou' && ' · Não entregue'}
                {m.status === 'lida' && ' · Lida'}
                {m.status === 'entregue' && ' · Entregue'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          aria-label="Mensagem"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Escreva a resposta..."
        />
        <Button onClick={enviar} disabled={enviando} className="gap-1.5">
          <Send className="size-4" />
          Enviar
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/mensagens/__tests__/thread.test.tsx'`
Expected: PASS (6 testes)

- [ ] **Step 6: Criar a página**

```tsx
// app/(app)/mensagens/[numero]/page.tsx
import { listarMensagensDaConversa } from '@/lib/consultas/conversa'
import { Thread } from './thread'

export default async function Page({
  params,
}: {
  params: Promise<{ numero: string }>
}) {
  const { numero } = await params
  const mensagens = await listarMensagensDaConversa(numero)

  return <Thread numero={numero} nome={numero} iniciais={mensagens} />
}
```

- [ ] **Step 7: Apontar a lista e as notificações para a thread**

Em `app/(app)/mensagens/lista-conversas.tsx`, cada linha de conversa vira `Link` para `/mensagens/{conversa.numero}`.

Em `lib/notificacoes.ts`, trocar o destino da notificação de mensagem:

```ts
destino: `/mensagens/${numero}`,
```

Ajustar o teste em `lib/__tests__/notificacoes.test.ts` que afirma o destino antigo (`/mensagens?busca=…`) para o novo — é mudança de comportamento intencional, não regressão.

- [ ] **Step 8: Typecheck, suíte e verificação real**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

Depois, com o app rodando: abrir uma conversa a partir do sino, responder, e confirmar que a mensagem aparece na thread e chega ao WhatsApp do contato.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(conversa): tela de conversa com resposta pela plataforma"
```

---

### Task 4: Esteira — banco e domínio

**Files:**
- Create: `supabase/migrations/0014_esteira.sql`
- Create: `lib/esteira.ts`
- Test: `lib/__tests__/esteira.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ETAPAS_PADRAO: readonly string[]`, `LIMITE_NOME_ETAPA = 24`, `LIMITE_ETAPAS = 12`, `nomeDeEtapaValido(nome: string): boolean`, `proximaOrdem(ordens: number[]): number`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/__tests__/esteira.test.ts
import { describe, expect, it } from 'vitest'
import {
  ETAPAS_PADRAO,
  LIMITE_ETAPAS,
  nomeDeEtapaValido,
  proximaOrdem,
} from '@/lib/esteira'

describe('etapas padrão', () => {
  // Esteira vazia não ensina nada; estas quatro cobrem o funil mínimo de
  // quem vende por WhatsApp.
  it('traz um funil inicial utilizável', () => {
    expect([...ETAPAS_PADRAO]).toEqual([
      'Novo',
      'Em conversa',
      'Negociando',
      'Fechado',
    ])
  })
})

describe('nomeDeEtapaValido', () => {
  it('aceita nome comum', () => {
    expect(nomeDeEtapaValido('Negociando')).toBe(true)
  })

  it('recusa vazio e só espaço', () => {
    expect(nomeDeEtapaValido('')).toBe(false)
    expect(nomeDeEtapaValido('   ')).toBe(false)
  })

  // Espelha o check da 0014; sem isto o insert falharia com 23514.
  it('recusa acima de 24 caracteres', () => {
    expect(nomeDeEtapaValido('x'.repeat(24))).toBe(true)
    expect(nomeDeEtapaValido('x'.repeat(25))).toBe(false)
  })
})

describe('proximaOrdem', () => {
  it('põe a nova no fim', () => {
    expect(proximaOrdem([0, 1, 2])).toBe(3)
  })

  it('começa do zero quando não há nenhuma', () => {
    expect(proximaOrdem([])).toBe(0)
  })

  // Remover uma etapa do meio deixa buracos; a próxima ainda tem de ser
  // maior que todas, senão duas etapas empatariam na ordenação.
  it('ignora buracos e usa o maior', () => {
    expect(proximaOrdem([0, 5, 2])).toBe(6)
  })
})

describe('LIMITE_ETAPAS', () => {
  it('existe para o quadro não virar rolagem horizontal infinita', () => {
    expect(LIMITE_ETAPAS).toBe(12)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/__tests__/esteira.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/esteira"`

- [ ] **Step 3: Implementar o domínio**

```ts
// lib/esteira.ts

/** Funil inicial de quem vende por WhatsApp; o usuário renomeia depois. */
export const ETAPAS_PADRAO = [
  'Novo',
  'Em conversa',
  'Negociando',
  'Fechado',
] as const

/** Espelha o check de `etapas.nome` na 0014. */
export const LIMITE_NOME_ETAPA = 24

/** Acima disto o quadro vira rolagem horizontal sem utilidade. */
export const LIMITE_ETAPAS = 12

export function nomeDeEtapaValido(nome: string): boolean {
  const limpo = nome.trim()
  return limpo.length >= 1 && limpo.length <= LIMITE_NOME_ETAPA
}

/**
 * Ordem da próxima etapa criada.
 *
 * Usa o maior e não a contagem: remover uma etapa do meio deixa buracos, e
 * contar produziria um número já ocupado, empatando duas colunas.
 */
export function proximaOrdem(ordens: number[]): number {
  if (ordens.length === 0) return 0
  return Math.max(...ordens) + 1
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/__tests__/esteira.test.ts`
Expected: PASS (8 testes)

- [ ] **Step 5: Escrever a migration**

```sql
-- supabase/migrations/0014_esteira.sql

-- Etapas do funil, ordenadas.
--
-- Separadas de `etiquetas` de propósito: etiqueta classifica livremente (um
-- contato pode ser "VIP" sem que isso tenha ordem), etapa é posição única no
-- funil e tem sequência. Na mesma tabela não daria para responder "quanto
-- tempo ficou em Negociando".
create table public.etapas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  nome       text not null,
  ordem      integer not null,
  criado_em  timestamptz not null default now(),
  constraint nome_etapa_valido check (length(trim(nome)) between 1 and 24),
  constraint etapa_unica_por_usuario unique (owner_id, nome)
);

create index etapas_owner_idx on public.etapas (owner_id, ordem);

-- Etapa apagada devolve o contato para "sem etapa" em vez de apagá-lo, como
-- já acontece com etiqueta.
alter table public.contatos
  add column etapa_id uuid references public.etapas(id) on delete set null;

create index contatos_etapa_idx on public.contatos (etapa_id);

-- Histórico de movimentação: é o que permite medir tempo em cada etapa e
-- taxa de avanço. Sem FK para etapas com cascade, senão renomear ou apagar
-- uma etapa apagaria o passado junto — o nome fica congelado no texto.
create table public.contato_etapa_historico (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  contato_id  uuid not null references public.contatos(id) on delete cascade,
  de          text,
  para        text not null,
  criado_em   timestamptz not null default now()
);

create index historico_contato_idx
  on public.contato_etapa_historico (owner_id, contato_id, criado_em desc);

alter table public.etapas enable row level security;
alter table public.contato_etapa_historico enable row level security;

create policy propria_etapa on public.etapas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy proprio_historico on public.contato_etapa_historico
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
```

- [ ] **Step 6: Aplicar no Supabase e conferir**

Aplicar `0014_esteira.sql` pelo SQL Editor. Depois:

```bash
set -a; . ./.env; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/etapas?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `[]` (tabela existe e está vazia), não erro de tabela inexistente.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0014_esteira.sql lib/esteira.ts lib/__tests__/esteira.test.ts
git commit -m "feat(esteira): etapas do funil, com histórico de movimentação"
```

---

### Task 5: Mover contato entre etapas

**Files:**
- Create: `app/(app)/esteira/actions.ts`
- Create: `lib/consultas/esteira.ts`
- Test: `app/(app)/esteira/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `ETAPAS_PADRAO`, `LIMITE_ETAPAS`, `nomeDeEtapaValido`, `proximaOrdem` (Task 4).
- Produces: `criarEtapa(nome: string)`, `moverContato(contatoId: string, etapaId: string | null)`, `removerEtapa(id: string)`, todas devolvendo `{ erro?: string; ok?: boolean }`; e `listarEsteira(): Promise<{ etapas: Etapa[]; contatos: ContatoNaEsteira[] }>`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// app/(app)/esteira/__tests__/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarEtapa, moverContato } from '@/app/(app)/esteira/actions'

const estado = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  etapas: [] as Record<string, unknown>[],
  contato: null as Record<string, unknown> | null,
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
    from: (tabela: string) => {
      const encadeado = {
        select: () => encadeado,
        eq: () => encadeado,
        order: () => encadeado,
        limit: () => encadeado,
        maybeSingle: async () => ({ data: estado.contato }),
        insert: async (valores: Record<string, unknown>) => {
          estado.inserts.push({ tabela, ...valores })
          return { error: null }
        },
        update: (valores: Record<string, unknown>) => {
          estado.updates.push({ tabela, ...valores })
          return { eq: () => ({ eq: async () => ({ error: null }) }) }
        },
        then: (r: (v: { data: unknown; error: null }) => void) =>
          r({ data: estado.etapas, error: null }),
      }
      return encadeado
    },
  }),
}))

beforeEach(() => {
  estado.usuario = { id: 'user-1' }
  estado.etapas = [{ id: 'e1', nome: 'Novo', ordem: 0 }]
  estado.contato = { id: 'c1', etapa_id: 'e1', etapas: { nome: 'Novo' } }
  estado.inserts = []
  estado.updates = []
})

describe('criarEtapa', () => {
  it('cria no fim da fila', async () => {
    const r = await criarEtapa('Negociando')

    expect(r).toEqual({ ok: true })
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'etapas',
      owner_id: 'user-1',
      nome: 'Negociando',
      ordem: 1,
    })
  })

  it('recusa nome vazio', async () => {
    const r = await criarEtapa('   ')
    expect(r.erro).toBeTruthy()
    expect(estado.inserts).toHaveLength(0)
  })

  it('recusa nome acima do limite', async () => {
    const r = await criarEtapa('x'.repeat(25))
    expect(r.erro).toBeTruthy()
    expect(estado.inserts).toHaveLength(0)
  })

  // Server action é chamável por HTTP direto: o teto tem de valer no servidor.
  it('recusa acima do teto de etapas', async () => {
    estado.etapas = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`,
      nome: `Etapa ${i}`,
      ordem: i,
    }))
    const r = await criarEtapa('Mais uma')

    expect(r.erro).toMatch(/limite/i)
    expect(estado.inserts).toHaveLength(0)
  })

  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await criarEtapa('Negociando')
    expect(r.erro).toMatch(/Sessão expirada/)
  })
})

describe('moverContato', () => {
  it('atualiza a etapa e registra o histórico', async () => {
    const r = await moverContato('c1', 'e2')

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({
      tabela: 'contatos',
      etapa_id: 'e2',
    })
    // O histórico guarda o nome, não o id: renomear a etapa depois não pode
    // reescrever o passado.
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'contato_etapa_historico',
      contato_id: 'c1',
      de: 'Novo',
    })
  })

  it('aceita tirar o contato da esteira', async () => {
    const r = await moverContato('c1', null)

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({ etapa_id: null })
  })

  it('recusa contato que não é do usuário', async () => {
    estado.contato = null
    const r = await moverContato('alheio', 'e2')

    expect(r.erro).toBeTruthy()
    expect(estado.updates).toHaveLength(0)
  })

  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await moverContato('c1', 'e2')
    expect(r.erro).toMatch(/Sessão expirada/)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/esteira/__tests__/actions.test.ts'`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar as ações**

```ts
// app/(app)/esteira/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { LIMITE_ETAPAS, nomeDeEtapaValido, proximaOrdem } from '@/lib/esteira'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoEsteira = { erro?: string; ok?: boolean }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function criarEtapa(nome: string): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const limpo = nome.trim()
  if (!nomeDeEtapaValido(limpo)) {
    return { erro: 'A etapa precisa de um nome de 1 a 24 caracteres.' }
  }

  const { data: existentes } = await supabase
    .from('etapas')
    .select('ordem')
    .eq('owner_id', user.id)

  const ordens = (existentes ?? []).map((e) => Number(e.ordem))

  // Server action é chamável por requisição HTTP direta: o teto precisa
  // valer aqui, não só no botão da tela.
  if (ordens.length >= LIMITE_ETAPAS) {
    return { erro: `Você atingiu o limite de ${LIMITE_ETAPAS} etapas.` }
  }

  const { error } = await supabase.from('etapas').insert({
    owner_id: user.id,
    nome: limpo,
    ordem: proximaOrdem(ordens),
  })

  if (error) {
    if (error.code === '23505') return { erro: 'Você já tem uma etapa com esse nome.' }
    return { erro: 'Não foi possível criar a etapa.' }
  }

  revalidatePath('/esteira')
  return { ok: true }
}

/**
 * Move o contato de etapa e registra a passagem.
 *
 * O histórico guarda o **nome** da etapa, não o id: renomear "Negociando"
 * para "Proposta" não pode reescrever o passado, e apagar a etapa não pode
 * levar o histórico junto.
 */
export async function moverContato(
  contatoId: string,
  etapaId: string | null,
): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: contato } = await supabase
    .from('contatos')
    .select('id, etapa_id, etapas(nome)')
    .eq('id', contatoId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!contato) return { erro: 'Contato não encontrado.' }

  let nomeDestino = 'Sem etapa'
  if (etapaId) {
    const { data: destino } = await supabase
      .from('etapas')
      .select('nome')
      .eq('id', etapaId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!destino) return { erro: 'Etapa não encontrada.' }
    nomeDestino = String(destino.nome)
  }

  const { error } = await supabase
    .from('contatos')
    .update({ etapa_id: etapaId, atualizado_em: new Date().toISOString() })
    .eq('id', contatoId)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível mover o contato.' }

  const de = (contato as { etapas?: { nome?: string } }).etapas?.nome ?? null

  // Falha aqui não desfaz a movimentação: o contato já está na etapa certa, e
  // perder uma linha de histórico é menos grave que devolver erro para uma
  // ação que aconteceu.
  const { error: erroHistorico } = await supabase
    .from('contato_etapa_historico')
    .insert({
      owner_id: user.id,
      contato_id: contatoId,
      de,
      para: nomeDestino,
    })

  if (erroHistorico) {
    console.error('[esteira] histórico não gravou:', erroHistorico.code, erroHistorico.message)
  }

  revalidatePath('/esteira')
  return { ok: true }
}

export async function removerEtapa(id: string): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // O `on delete set null` da 0014 devolve os contatos para "sem etapa"; o
  // histórico sobrevive porque guarda o nome, não a referência.
  const { error } = await supabase
    .from('etapas')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível remover a etapa.' }

  revalidatePath('/esteira')
  return { ok: true }
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/esteira/__tests__/actions.test.ts'`
Expected: PASS (9 testes)

- [ ] **Step 5: Escrever a consulta da esteira**

```ts
// lib/consultas/esteira.ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type Etapa = { id: string; nome: string; ordem: number }
export type ContatoNaEsteira = {
  id: string
  nome: string
  numero: string
  etapaId: string | null
}

/**
 * O funil inteiro numa ida só.
 *
 * Contato sem etapa entra na coluna "Sem etapa" da tela: escondê-lo faria
 * sumir da vista quem acabou de ser importado, que é justamente quem precisa
 * ser triado.
 */
export async function listarEsteira(): Promise<{
  etapas: Etapa[]
  contatos: ContatoNaEsteira[]
}> {
  const supabase = await criarClienteServidor()

  const [etapas, contatos] = await Promise.all([
    supabase.from('etapas').select('id, nome, ordem').order('ordem'),
    supabase.from('contatos').select('id, nome, numero, etapa_id').order('nome'),
  ])

  return {
    etapas: (etapas.data ?? []).map((e) => ({
      id: String(e.id),
      nome: String(e.nome),
      ordem: Number(e.ordem),
    })),
    contatos: (contatos.data ?? []).map((c) => ({
      id: String(c.id),
      nome: String(c.nome),
      numero: String(c.numero),
      etapaId: c.etapa_id ? String(c.etapa_id) : null,
    })),
  }
}
```

- [ ] **Step 6: Typecheck e suíte**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 7: Commit**

```bash
git add 'app/(app)/esteira/' lib/consultas/esteira.ts
git commit -m "feat(esteira): mover contato entre etapas, com histórico"
```

---

### Task 6: Tela da esteira

**Files:**
- Create: `app/(app)/esteira/page.tsx`
- Create: `app/(app)/esteira/quadro.tsx`
- Modify: `components/sidebar.tsx`
- Test: `app/(app)/esteira/__tests__/quadro.test.tsx`

**Interfaces:**
- Consumes: `listarEsteira` (Task 5), `moverContato`, `criarEtapa`.
- Produces: componente `Quadro({ etapas, contatos })`.

Movimentação por **`<select>` de etapa em cada cartão**, não arrastar-e-soltar. Drag-and-drop exige biblioteca, quebra no toque e é inacessível por teclado; o select resolve o mesmo problema e é testável. Arrastar pode entrar depois, como enfeite sobre uma base que já funciona.

- [ ] **Step 1: Escrever o teste falhando**

```tsx
// app/(app)/esteira/__tests__/quadro.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Quadro } from '@/app/(app)/esteira/quadro'

const acoes = vi.hoisted(() => ({ mover: vi.fn(), criar: vi.fn() }))
const navegacao = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => navegacao }))
vi.mock('@/app/(app)/esteira/actions', () => ({
  moverContato: (c: string, e: string | null) => acoes.mover(c, e),
  criarEtapa: (n: string) => acoes.criar(n),
  removerEtapa: vi.fn(),
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
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/esteira/__tests__/quadro.test.tsx'`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o quadro**

```tsx
// app/(app)/esteira/quadro.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { moverContato } from '@/app/(app)/esteira/actions'
import type { ContatoNaEsteira, Etapa } from '@/lib/consultas/esteira'

/** Coluna dos que ainda não foram triados. */
const SEM_ETAPA = 'Sem etapa'

export function Quadro({
  etapas,
  contatos,
}: {
  etapas: Etapa[]
  contatos: ContatoNaEsteira[]
}) {
  const router = useRouter()
  const [erro, setErro] = useState('')

  async function mover(contatoId: string, valor: string) {
    setErro('')
    const resultado = await moverContato(contatoId, valor === '' ? null : valor)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    router.refresh()
  }

  if (etapas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crie a primeira etapa para começar a organizar os contatos.
      </p>
    )
  }

  const colunas = [
    ...etapas.map((e) => ({ id: e.id, nome: e.nome })),
    { id: null, nome: SEM_ETAPA },
  ]

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas.map((coluna) => {
          const daColuna = contatos.filter((c) => c.etapaId === coluna.id)
          return (
            <section
              key={coluna.id ?? 'sem-etapa'}
              aria-label={coluna.nome}
              className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3"
            >
              <h2 className="text-sm font-semibold text-foreground">
                {coluna.nome}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {daColuna.length}
                </span>
              </h2>

              {daColuna.map((c) => (
                <article
                  key={c.id}
                  className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-2.5"
                >
                  <span className="text-sm font-medium text-foreground">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">{c.numero}</span>

                  {/* Select e não arrastar-e-soltar: funciona no toque, é
                      acessível por teclado e não precisa de biblioteca. */}
                  <select
                    aria-label={`Etapa de ${c.nome}`}
                    value={c.etapaId ?? ''}
                    onChange={(e) => mover(c.id, e.target.value)}
                    className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                  >
                    <option value="">{SEM_ETAPA}</option>
                    {etapas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/esteira/__tests__/quadro.test.tsx'`
Expected: PASS (7 testes)

- [ ] **Step 5: Criar a página e o item da barra lateral**

```tsx
// app/(app)/esteira/page.tsx
import { listarEsteira } from '@/lib/consultas/esteira'
import { Quadro } from './quadro'

export default async function Page() {
  const { etapas, contatos } = await listarEsteira()
  return <Quadro etapas={etapas} contatos={contatos} />
}
```

Em `components/sidebar.tsx`, acrescentar o item `Esteira` apontando para `/esteira`, seguindo exatamente o formato dos itens já existentes (abrir o arquivo e copiar a forma; ele usa um array de rotas com ícone do lucide-react).

- [ ] **Step 6: Typecheck, suíte e build**

Run: `npx tsc --noEmit && npm run test:run && npm run build`
Expected: os três limpos.

> `next build` reescreve `next-env.d.ts` para os tipos de produção. Restaurar com `git checkout -- next-env.d.ts` antes de commitar.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(esteira): quadro do funil por etapa"
```

---

## Verificação final

- [ ] `npm run test:run` — suíte verde
- [ ] `npx tsc --noEmit` — limpo
- [ ] `npm run build` — completo
- [ ] Abrir uma conversa pelo sino, responder, e a mensagem chegar ao WhatsApp do contato
- [ ] A resposta do contato aparecer na thread sem recarregar (Realtime)
- [ ] Criar etapa, mover contato, e o histórico ganhar linha em `contato_etapa_historico`
- [ ] `git status` limpo (`next-env.d.ts` restaurado)

## O que este plano deliberadamente NÃO faz

- **Não classifica por interesse ou engajamento.** A frase do `implementation.txt` pede isso, mas depende de métricas de interação que ainda não existem; é o plano `2026-08-21-inteligencia-clientes.md`. Esta esteira é posicionamento manual.
- **Não envia mídia**, só texto. `endpoints.mensagem.midia` existe e o upload já vive em Mídias, mas juntar as duas coisas é escopo próprio.
- **Não arrasta-e-solta.** Ver Task 6.
- **Não pagina a thread.** Teto de 200 mensagens por conversa; acima disso a tela mostra as mais recentes. Paginar só faz sentido com volume que ainda não existe.
