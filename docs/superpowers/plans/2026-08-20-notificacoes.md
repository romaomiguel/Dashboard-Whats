# Notificações — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o sino da topbar avisar, ao vivo, sobre mensagem recebida, campanha concluída e conexão caída, com os três interruptores de Configurações decidindo o que é criado.

**Architecture:** Uma tabela `notificacoes` com chave de agrupamento única por dono. Três produtores já existentes (receptor de webhook e processador de disparos) chamam um único `registrarNotificacao`, que consulta a preferência, monta o texto e grava. O sino é componente de cliente que recebe a lista inicial do servidor e assina `postgres_changes` do Supabase Realtime.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres + Realtime + `@supabase/ssr`), Tailwind 4, Base UI, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-notificacoes-design.md`

## Global Constraints

- Gerenciador de pacotes: **pnpm**. Não usar npm nem yarn.
- Idioma do código: identificadores, mensagens e comentários em **português**.
- Alias de import: `@/` aponta para a raiz do projeto.
- Em Next.js 16, `cookies()`, `params` e `searchParams` são **assíncronos** — sempre `await`.
- Módulo com `'use server'` só exporta função assíncrona. Constante compartilhada vai para arquivo próprio.
- Componente de cliente não pode importar módulo que importe `@/lib/supabase/server` — arrasta `server-only` para o navegador e quebra o build. Tipos e rótulos ficam em módulo separado, como `lib/conexoes.ts` e `lib/consultas/conexao.ts`.
- Restrição única usada em `ON CONFLICT` precisa ser **completa**, nunca parcial: índice parcial não é inferível e a gravação falha com `42P10`.
- RLS no formato da migration 0009: `for all to authenticated` com `owner_id = (select auth.uid())`.
- Formatação de data sempre por `lib/datas.ts`, com fuso fixo, senão o React acusa erro de hidratação.
- Rodar `pnpm exec tsc --noEmit`, `pnpm test:run` e `pnpm build` antes de cada commit.

---

### Task 1: Modelo de dados e migration

**Files:**
- Create: `supabase/migrations/0012_notificacoes.sql`
- Create: `lib/notificacoes.ts`
- Test: `lib/__tests__/notificacoes.test.ts`

**Interfaces:**
- Consumes: `chaveDoNumero` de `@/lib/numeros`
- Produces:
  - `type TipoNotificacao = 'mensagem' | 'disparo' | 'conexao'`
  - `type Notificacao = { id: string; tipo: TipoNotificacao; titulo: string; corpo: string | null; destino: string | null; lida: boolean; quando: string }`
  - `type EventoNotificavel` (união discriminada, ver Step 3)
  - `montarNotificacao(evento: EventoNotificavel): { tipo: TipoNotificacao; chave: string; titulo: string; corpo: string | null; destino: string }`
  - `PREFERENCIA_POR_TIPO: Record<TipoNotificacao, 'notificar_mensagem' | 'notificar_disparo' | 'notificar_conexao'>`
  - `DIAS_RETENCAO = 30`
  - `ICONE_POR_TIPO` não entra aqui (é de cliente, fica na Task 5)

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0012_notificacoes.sql`:

```sql
create type public.notificacao_tipo as enum ('mensagem', 'disparo', 'conexao');

create table public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  tipo           public.notificacao_tipo not null,
  -- Agrupa: 'mensagem:5565984627628', 'disparo:<uuid>', 'conexao:<uuid>'.
  chave          text not null,
  titulo         text not null,
  corpo          text,
  destino        text,
  lida           boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint titulo_valido check (length(trim(titulo)) between 1 and 120),
  -- Restrição completa, não índice parcial: só assim o ON CONFLICT a infere.
  constraint notificacao_unica_por_dono unique (owner_id, chave)
);

-- Ordena por atualizado_em: conversa antiga com mensagem nova sobe ao topo.
create index notificacoes_sino_idx
  on public.notificacoes (owner_id, lida, atualizado_em desc);

alter table public.notificacoes enable row level security;

create policy propria_notificacao on public.notificacoes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Sem isto o canal de Realtime conecta e nunca recebe nada.
alter publication supabase_realtime add table public.notificacoes;

alter table public.profiles
  add column notificar_mensagem boolean not null default true,
  add column notificar_disparo  boolean not null default true,
  add column notificar_conexao  boolean not null default true;
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `lib/__tests__/notificacoes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { montarNotificacao, PREFERENCIA_POR_TIPO } from '@/lib/notificacoes'

describe('montarNotificacao — mensagem', () => {
  it('agrupa pela forma canônica do número, sem o nono dígito', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '5565984627628',
      nome: 'Amanda',
      texto: 'Oi, tudo bem?',
    })
    expect(n.chave).toBe('mensagem:556584627628')
  })

  it('a mesma pessoa nas duas formas dá a mesma chave', () => {
    const comNove = montarNotificacao({
      tipo: 'mensagem',
      numero: '5565984627628',
      nome: 'Amanda',
      texto: 'a',
    })
    const semNove = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: 'b',
    })
    expect(comNove.chave).toBe(semNove.chave)
  })

  it('usa o nome no título e o texto no corpo', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: 'Oi, tudo bem?',
    })
    expect(n.titulo).toBe('Amanda respondeu')
    expect(n.corpo).toBe('Oi, tudo bem?')
  })

  it('sem nome, identifica pelo número', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: null,
      texto: 'Oi',
    })
    expect(n.titulo).toBe('556584627628 respondeu')
  })

  it('corta corpo longo, para o painel não virar parede de texto', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: 'a'.repeat(200),
    })
    expect(n.corpo!.length).toBeLessThanOrEqual(120)
  })

  it('leva o número na busca do destino', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: 'Oi',
    })
    expect(n.destino).toBe('/mensagens?busca=556584627628')
  })
})

describe('montarNotificacao — disparo', () => {
  it('resume entregues sobre total', () => {
    const n = montarNotificacao({
      tipo: 'disparo',
      id: 'd1',
      nome: 'Promoção Black Friday',
      enviados: 287,
      total: 300,
    })
    expect(n.chave).toBe('disparo:d1')
    expect(n.titulo).toBe('Promoção Black Friday concluída')
    expect(n.corpo).toBe('287 de 300 enviadas')
    expect(n.destino).toBe('/disparos')
  })
})

describe('montarNotificacao — conexao', () => {
  it('nomeia a conexão que caiu', () => {
    const n = montarNotificacao({
      tipo: 'conexao',
      id: 'c1',
      nome: 'Comercial 01',
    })
    expect(n.chave).toBe('conexao:c1')
    expect(n.titulo).toBe('Comercial 01 desconectou')
    expect(n.corpo).toBe('Leia o QR code para reconectar.')
    expect(n.destino).toBe('/conexao')
  })
})

describe('PREFERENCIA_POR_TIPO', () => {
  it('liga cada tipo à sua coluna em profiles', () => {
    expect(PREFERENCIA_POR_TIPO.mensagem).toBe('notificar_mensagem')
    expect(PREFERENCIA_POR_TIPO.disparo).toBe('notificar_disparo')
    expect(PREFERENCIA_POR_TIPO.conexao).toBe('notificar_conexao')
  })
})
```

- [ ] **Step 3: Rodar e verificar que falha**

Run: `pnpm exec vitest run lib/__tests__/notificacoes.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/notificacoes"`

- [ ] **Step 4: Escrever `lib/notificacoes.ts`**

```ts
import { chaveDoNumero } from '@/lib/numeros'

export const TIPOS_NOTIFICACAO = ['mensagem', 'disparo', 'conexao'] as const

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number]

export type Notificacao = {
  id: string
  tipo: TipoNotificacao
  titulo: string
  corpo: string | null
  destino: string | null
  lida: boolean
  quando: string
}

/** Coluna de `profiles` que decide se cada tipo chega a ser criado. */
export const PREFERENCIA_POR_TIPO = {
  mensagem: 'notificar_mensagem',
  disparo: 'notificar_disparo',
  conexao: 'notificar_conexao',
} as const

export type ColunaPreferencia =
  (typeof PREFERENCIA_POR_TIPO)[TipoNotificacao]

export const DIAS_RETENCAO = 30

/** Corpo mais longo que isto vira parede de texto no painel. */
const LIMITE_CORPO = 120

export type EventoNotificavel =
  | { tipo: 'mensagem'; numero: string; nome: string | null; texto: string }
  | { tipo: 'disparo'; id: string; nome: string; enviados: number; total: number }
  | { tipo: 'conexao'; id: string; nome: string }

export type NotificacaoMontada = {
  tipo: TipoNotificacao
  chave: string
  titulo: string
  corpo: string | null
  destino: string
}

function encurtar(texto: string): string {
  const limpo = texto.trim()
  if (limpo.length <= LIMITE_CORPO) return limpo
  return `${limpo.slice(0, LIMITE_CORPO - 1)}…`
}

/**
 * Traduz um evento do sistema em notificação.
 *
 * Função pura de propósito: é aqui que mora todo o texto que o usuário lê, e
 * dá para testá-la sem banco nem webhook.
 */
export function montarNotificacao(evento: EventoNotificavel): NotificacaoMontada {
  if (evento.tipo === 'mensagem') {
    // Chave canônica: o WhatsApp devolve o número brasileiro sem o nono
    // dígito, e sem isto a mesma pessoa geraria duas notificações.
    const numero = chaveDoNumero(evento.numero)
    return {
      tipo: 'mensagem',
      chave: `mensagem:${numero}`,
      titulo: `${evento.nome ?? numero} respondeu`,
      corpo: encurtar(evento.texto),
      destino: `/mensagens?busca=${encodeURIComponent(numero)}`,
    }
  }

  if (evento.tipo === 'disparo') {
    return {
      tipo: 'disparo',
      chave: `disparo:${evento.id}`,
      titulo: `${evento.nome} concluída`,
      corpo: `${evento.enviados.toLocaleString('pt-BR')} de ${evento.total.toLocaleString('pt-BR')} enviadas`,
      destino: '/disparos',
    }
  }

  return {
    tipo: 'conexao',
    chave: `conexao:${evento.id}`,
    titulo: `${evento.nome} desconectou`,
    corpo: 'Leia o QR code para reconectar.',
    destino: '/conexao',
  }
}
```

- [ ] **Step 5: Rodar e verificar que passa**

Run: `pnpm exec vitest run lib/__tests__/notificacoes.test.ts`
Expected: PASS — 9 testes

- [ ] **Step 6: Verificar tipos e build**

Run: `pnpm exec tsc --noEmit && pnpm test:run && pnpm build`
Expected: sem erro; a suíte inteira passa

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0012_notificacoes.sql lib/notificacoes.ts lib/__tests__/notificacoes.test.ts
git commit -m "feat: modelo de notificações e montagem dos textos

Tabela notificacoes com chave de agrupamento única por dono, no formato
'mensagem:<numero canônico>'. A restrição é completa, não índice parcial:
parcial não é inferível no ON CONFLICT e a gravação falharia com 42P10,
como aconteceu na 0010.

montarNotificacao é pura e concentra todo texto que o usuário lê, o que
permite testá-lo sem banco. O número usa a forma sem o nono dígito, senão
a mesma pessoa geraria duas notificações.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Gravação com portão de preferência e retenção

**Files:**
- Create: `lib/notificacoes/registrar.ts`
- Test: `lib/notificacoes/__tests__/registrar.test.ts`

**Interfaces:**
- Consumes: `montarNotificacao`, `PREFERENCIA_POR_TIPO`, `DIAS_RETENCAO`, `EventoNotificavel` de `@/lib/notificacoes`
- Produces: `registrarNotificacao(db: SupabaseClient, ownerId: string, evento: EventoNotificavel): Promise<boolean>` — devolve `true` se gravou, `false` se a preferência estava desligada

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/notificacoes/__tests__/registrar.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'

const banco = vi.hoisted(() => ({
  perfil: {
    notificar_mensagem: true,
    notificar_disparo: true,
    notificar_conexao: true,
  } as Record<string, boolean>,
  upserts: [] as { valores: Record<string, unknown>; opcoes: unknown }[],
  deletes: [] as Record<string, unknown>[],
  erroUpsert: null as { message: string } | null,
}))

function clienteFalso() {
  return {
    from(tabela: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: banco.perfil }),
          }),
        }),
        upsert: async (valores: Record<string, unknown>, opcoes: unknown) => {
          banco.upserts.push({ valores, opcoes })
          return { error: banco.erroUpsert }
        },
        delete: () => {
          const filtros: Record<string, unknown> = { tabela }
          const encadeado = {
            eq(coluna: string, valor: unknown) {
              filtros[coluna] = valor
              return encadeado
            },
            lt(coluna: string, valor: unknown) {
              filtros[coluna] = valor
              banco.deletes.push(filtros)
              return encadeado
            },
            then(resolver: (r: { error: unknown }) => void) {
              resolver({ error: null })
            },
          }
          return encadeado
        },
      }
    },
  } as never
}

const mensagem = {
  tipo: 'mensagem' as const,
  numero: '556584627628',
  nome: 'Amanda',
  texto: 'Oi',
}

beforeEach(() => {
  banco.perfil = {
    notificar_mensagem: true,
    notificar_disparo: true,
    notificar_conexao: true,
  }
  banco.upserts = []
  banco.deletes = []
  banco.erroUpsert = null
})

describe('registrarNotificacao', () => {
  it('grava amarrada ao dono, com a chave montada', async () => {
    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(gravou).toBe(true)
    expect(banco.upserts[0].valores).toMatchObject({
      owner_id: 'user-1',
      tipo: 'mensagem',
      chave: 'mensagem:556584627628',
      titulo: 'Amanda respondeu',
      lida: false,
    })
  })

  // Desligado significa não criar, não criar e esconder: senão o desligado
  // acumularia linha no banco à toa.
  it('preferência desligada não grava nada', async () => {
    banco.perfil.notificar_mensagem = false

    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(gravou).toBe(false)
    expect(banco.upserts).toHaveLength(0)
  })

  it('cada tipo consulta a sua própria preferência', async () => {
    banco.perfil.notificar_mensagem = false

    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', {
      tipo: 'conexao',
      id: 'c1',
      nome: 'Comercial',
    })

    expect(gravou).toBe(true)
  })

  it('atividade nova na mesma chave volta a marcar como não lida', async () => {
    await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(banco.upserts[0].valores).toMatchObject({ lida: false })
    expect(banco.upserts[0].opcoes).toEqual({ onConflict: 'owner_id,chave' })
  })

  it('limpa as lidas antigas do próprio dono, sem depender de cron', async () => {
    await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    const limpeza = banco.deletes.at(-1)
    expect(limpeza).toMatchObject({ owner_id: 'user-1', lida: true })
    expect(typeof limpeza!.atualizado_em).toBe('string')
  })

  it('perfil sem colunas de preferência não impede notificar', async () => {
    // Migration 0012 ainda não rodada: melhor notificar do que sumir calado.
    banco.perfil = {}

    const gravou = await registrarNotificacao(clienteFalso(), 'user-1', mensagem)

    expect(gravou).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm exec vitest run lib/notificacoes/__tests__/registrar.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/notificacoes/registrar"`

- [ ] **Step 3: Escrever `lib/notificacoes/registrar.ts`**

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DIAS_RETENCAO,
  montarNotificacao,
  PREFERENCIA_POR_TIPO,
  type EventoNotificavel,
} from '@/lib/notificacoes'

/**
 * Único ponto de gravação de notificação.
 *
 * Concentra o portão de preferência, a montagem do texto e a retenção, de
 * modo que os produtores só precisem relatar o que aconteceu. Recebe o
 * cliente pronto porque roda em dois contextos: no receptor de webhook, com
 * service role e sem sessão, e no processador de disparos.
 *
 * Devolve se gravou. Falha de banco vira `false` e log, nunca exceção: uma
 * notificação perdida é menos grave que um evento de webhook reenviado em
 * laço ou um disparo interrompido.
 */
export async function registrarNotificacao(
  db: SupabaseClient,
  ownerId: string,
  evento: EventoNotificavel,
): Promise<boolean> {
  const coluna = PREFERENCIA_POR_TIPO[evento.tipo]

  const { data: perfil } = await db
    .from('profiles')
    .select(coluna)
    .eq('id', ownerId)
    .maybeSingle()

  // Coluna ausente significa migration não rodada; notificar é o padrão, e
  // sumir em silêncio seria pior que uma notificação a mais.
  const preferencia = (perfil as Record<string, unknown> | null)?.[coluna]
  if (preferencia === false) return false

  const montada = montarNotificacao(evento)
  const agora = new Date().toISOString()

  const { error } = await db.from('notificacoes').upsert(
    {
      owner_id: ownerId,
      tipo: montada.tipo,
      chave: montada.chave,
      titulo: montada.titulo,
      corpo: montada.corpo,
      destino: montada.destino,
      // Atividade nova volta a pedir atenção, ainda que já tivesse sido lida.
      lida: false,
      atualizado_em: agora,
    },
    { onConflict: 'owner_id,chave' },
  )

  if (error) {
    console.error('[notificacao] não gravou:', error.code, error.message)
    return false
  }

  await limparAntigas(db, ownerId)
  return true
}

/**
 * Retenção junto da gravação, e não numa rotina agendada.
 *
 * O cron de disparos é opcional e pode nunca ser configurado; retenção que
 * depende de algo opcional não é retenção. A consulta usa o índice do sino.
 */
async function limparAntigas(db: SupabaseClient, ownerId: string) {
  const limite = new Date(
    Date.now() - DIAS_RETENCAO * 24 * 60 * 60 * 1000,
  ).toISOString()

  await db
    .from('notificacoes')
    .delete()
    .eq('owner_id', ownerId)
    .eq('lida', true)
    .lt('atualizado_em', limite)
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `pnpm exec vitest run lib/notificacoes/__tests__/registrar.test.ts`
Expected: PASS — 6 testes

- [ ] **Step 5: Verificar tipos e suíte**

Run: `pnpm exec tsc --noEmit && pnpm test:run`
Expected: sem erro

- [ ] **Step 6: Commit**

```bash
git add lib/notificacoes/registrar.ts lib/notificacoes/__tests__/registrar.test.ts
git commit -m "feat: gravação de notificação com preferência e retenção

Um ponto só concentra o portão de preferência, a montagem do texto e a
limpeza, para os produtores só precisarem relatar o que aconteceu.

Desligado significa não criar, não criar e esconder: assim o desligado não
acumula linha. Coluna ausente, de migration não rodada, notifica mesmo
assim — sumir calado seria pior.

A retenção acontece junto da gravação em vez de num cron: o de disparos é
opcional e pode nunca existir.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Consulta e ações do sino

**Files:**
- Create: `lib/consultas/notificacoes.ts`
- Create: `app/(app)/notificacoes/actions.ts`
- Test: `app/(app)/notificacoes/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `Notificacao`, `TIPOS_NOTIFICACAO` de `@/lib/notificacoes`; `criarClienteServidor` de `@/lib/supabase/server`
- Produces:
  - `listarNotificacoes(): Promise<Notificacao[]>`
  - `marcarComoLida(id: string): Promise<{ erro?: string; ok?: boolean }>`
  - `marcarTodasComoLidas(): Promise<{ erro?: string; ok?: boolean }>`

- [ ] **Step 1: Escrever `lib/consultas/notificacoes.ts`**

```ts
import { TIPOS_NOTIFICACAO, type Notificacao } from '@/lib/notificacoes'
import { criarClienteServidor } from '@/lib/supabase/server'

/** Limite do painel: passar disso vira rolagem infinita sem utilidade. */
const LIMITE_PAINEL = 30

function ehTipo(valor: string): valor is Notificacao['tipo'] {
  return (TIPOS_NOTIFICACAO as readonly string[]).includes(valor)
}

/**
 * Notificações do usuário logado, das mais recentes.
 *
 * Ordena por atualizado_em, não por criado_em: conversa antiga que recebe
 * mensagem nova precisa subir ao topo do sino.
 *
 * Lista vazia quando a tabela ainda não existe, para o app continuar de pé
 * antes de a migration 0012 rodar.
 */
export async function listarNotificacoes(): Promise<Notificacao[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, tipo, titulo, corpo, destino, lida, atualizado_em')
    .order('atualizado_em', { ascending: false })
    .limit(LIMITE_PAINEL)

  if (error || !data) return []

  return data
    .filter((linha) => ehTipo(String(linha.tipo)))
    .map((linha) => ({
      id: String(linha.id),
      tipo: String(linha.tipo) as Notificacao['tipo'],
      titulo: String(linha.titulo),
      corpo: linha.corpo ? String(linha.corpo) : null,
      destino: linha.destino ? String(linha.destino) : null,
      lida: Boolean(linha.lida),
      quando: String(linha.atualizado_em),
    }))
}
```

- [ ] **Step 2: Escrever o teste das ações**

Criar `app/(app)/notificacoes/__tests__/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  marcarComoLida,
  marcarTodasComoLidas,
} from '@/app/(app)/notificacoes/actions'

const banco = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  erro: null as { message: string } | null,
  updates: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: banco.usuario } }) },
    from: () => ({
      update: (valores: Record<string, unknown>) => {
        const filtros: Record<string, unknown> = { valores }
        const encadeado = {
          eq(coluna: string, valor: unknown) {
            filtros[coluna] = valor
            banco.updates = banco.updates.filter((u) => u !== filtros)
            banco.updates.push(filtros)
            return encadeado
          },
          then(resolver: (r: { error: unknown }) => void) {
            resolver({ error: banco.erro })
          },
        }
        return encadeado
      },
    }),
  }),
}))

beforeEach(() => {
  banco.usuario = { id: 'user-1' }
  banco.erro = null
  banco.updates = []
})

describe('marcarComoLida', () => {
  it('marca só a escolhida, filtrando por dono', async () => {
    const estado = await marcarComoLida('n1')

    expect(estado).toEqual({ ok: true })
    expect(banco.updates.at(-1)).toMatchObject({
      id: 'n1',
      owner_id: 'user-1',
      valores: { lida: true },
    })
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await marcarComoLida('n1')

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.updates).toHaveLength(0)
  })
})

describe('marcarTodasComoLidas', () => {
  it('marca as não lidas do dono, sem varrer as já lidas', async () => {
    const estado = await marcarTodasComoLidas()

    expect(estado).toEqual({ ok: true })
    expect(banco.updates.at(-1)).toMatchObject({
      owner_id: 'user-1',
      lida: false,
      valores: { lida: true },
    })
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await marcarTodasComoLidas()

    expect(estado.erro).toMatch(/Sessão expirada/)
  })
})
```

- [ ] **Step 3: Rodar e verificar que falha**

Run: `pnpm exec vitest run "app/(app)/notificacoes/__tests__/actions.test.ts"`
Expected: FAIL — `Failed to resolve import "@/app/(app)/notificacoes/actions"`

- [ ] **Step 4: Escrever `app/(app)/notificacoes/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoNotificacao = { erro?: string; ok?: boolean }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Marca uma notificação como lida. O filtro por dono é a segunda tranca. */
export async function marcarComoLida(id: string): Promise<EstadoNotificacao> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível marcar como lida.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Limpa o contador de uma vez. */
export async function marcarTodasComoLidas(): Promise<EstadoNotificacao> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // Filtrar por lida=false evita reescrever linha que já estava lida.
  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('owner_id', user.id)
    .eq('lida', false)

  if (error) return { erro: 'Não foi possível marcar todas como lidas.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}
```

- [ ] **Step 5: Rodar e verificar que passa**

Run: `pnpm exec vitest run "app/(app)/notificacoes/__tests__/actions.test.ts"`
Expected: PASS — 4 testes

- [ ] **Step 6: Verificar tipos e suíte**

Run: `pnpm exec tsc --noEmit && pnpm test:run`
Expected: sem erro

- [ ] **Step 7: Commit**

```bash
git add lib/consultas/notificacoes.ts "app/(app)/notificacoes/actions.ts" "app/(app)/notificacoes/__tests__/actions.test.ts"
git commit -m "feat: consulta e ações de leitura das notificações

A listagem ordena por atualizado_em, não por criado_em: conversa antiga
com mensagem nova precisa subir ao topo do sino. Devolve vazio se a tabela
não existir, para o app continuar de pé antes da migration.

Marcar todas filtra por lida=false para não reescrever linha já lida, e
ambas as ações filtram por dono além da RLS.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Produtores chamam a gravação

**Files:**
- Modify: `app/api/webhooks/evolution/[segredo]/route.ts` (função `registrarRecebida` e o despacho de eventos)
- Modify: `lib/disparos/processador.ts` (onde a campanha muda para concluído)
- Test: `lib/notificacoes/__tests__/gatilho-conexao.test.ts`

**Interfaces:**
- Consumes: `registrarNotificacao` de `@/lib/notificacoes/registrar`; `criarClienteAdmin` de `@/lib/supabase/admin`
- Produces: `deveNotificarQueda(estadoAnterior: string, estadoNovo: string): boolean` exportada de `@/lib/notificacoes`

- [ ] **Step 1: Escrever o teste da regra de queda**

Criar `lib/notificacoes/__tests__/gatilho-conexao.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deveNotificarQueda } from '@/lib/notificacoes'

describe('deveNotificarQueda', () => {
  // Toda instância nasce fechada: sem a condição de vir de conectada, criar
  // uma conexão avisaria queda antes de o QR ser lido.
  it('não avisa quando a conexão nunca esteve conectada', () => {
    expect(deveNotificarQueda('criada', 'close')).toBe(false)
    expect(deveNotificarQueda('conectando', 'close')).toBe(false)
  })

  it('avisa quando cai depois de conectada', () => {
    expect(deveNotificarQueda('conectada', 'close')).toBe(true)
  })

  it('não avisa quando conecta', () => {
    expect(deveNotificarQueda('conectando', 'open')).toBe(false)
  })

  it('não avisa de novo se já estava desconectada', () => {
    expect(deveNotificarQueda('desconectada', 'close')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm exec vitest run lib/notificacoes/__tests__/gatilho-conexao.test.ts`
Expected: FAIL — `deveNotificarQueda is not a function`

- [ ] **Step 3: Acrescentar a regra em `lib/notificacoes.ts`**

Ao final do arquivo:

```ts
/**
 * Se uma mudança de estado merece avisar que a conexão caiu.
 *
 * A condição de vir de conectada existe porque toda instância nasce fechada:
 * sem ela, criar uma conexão avisaria queda antes de o QR ser lido.
 */
export function deveNotificarQueda(
  estadoAnterior: string,
  estadoNovo: string,
): boolean {
  return estadoAnterior === 'conectada' && estadoNovo === 'close'
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `pnpm exec vitest run lib/notificacoes/__tests__/gatilho-conexao.test.ts`
Expected: PASS — 4 testes

- [ ] **Step 5: Notificar mensagem recebida no webhook**

Em `app/api/webhooks/evolution/[segredo]/route.ts`, acrescentar aos imports:

```ts
import { registrarNotificacao } from '@/lib/notificacoes/registrar'
import { deveNotificarQueda } from '@/lib/notificacoes'
```

Dentro de `registrarRecebida`, logo após o bloco que registra o erro do upsert, acrescentar:

```ts
  // Só resposta de contato vira notificação: o que sai do próprio número não
  // é novidade para quem enviou.
  if (!daPropriaConta) {
    await registrarNotificacao(admin, String(instancia.owner_id), {
      tipo: 'mensagem',
      numero,
      nome: dados.pushName ?? null,
      texto,
    })
  }
```

- [ ] **Step 6: Notificar queda de conexão no webhook**

No mesmo arquivo, antes do `export async function POST`, acrescentar:

```ts
/** Avisa quando uma conexão que estava no ar cai. */
async function registrarQueda(evento: EventoWebhook) {
  const dados = evento.data as { state?: string; statusReason?: number } | null
  const estadoNovo = String(dados?.state ?? '')

  const admin = criarClienteAdmin()

  const { data: instancia } = await admin
    .from('instances')
    .select('id, owner_id, nome, status')
    .eq('evolution_name', evento.instance)
    .maybeSingle()

  if (!instancia) return
  if (!deveNotificarQueda(String(instancia.status), estadoNovo)) return

  // O banco precisa refletir a queda, senão a tela seguiria dizendo conectada
  // até alguém abrir Conexão.
  await admin
    .from('instances')
    .update({ status: 'desconectada', atualizado_em: new Date().toISOString() })
    .eq('id', instancia.id)

  await registrarNotificacao(admin, String(instancia.owner_id), {
    tipo: 'conexao',
    id: String(instancia.id),
    nome: String(instancia.nome),
  })
}
```

E no despacho de eventos, junto dos dois `if` existentes:

```ts
    if (tipo === 'CONNECTION_UPDATE') await registrarQueda(evento)
```

- [ ] **Step 7: Notificar campanha concluída no processador**

Em `lib/disparos/processador.ts`, acrescentar ao topo:

```ts
import { registrarNotificacao } from '@/lib/notificacoes/registrar'
```

No bloco final, substituir a atualização do disparo por:

```ts
  const concluiu = restantes === 0

  await db
    .from('disparos')
    .update({
      enviados: totalEnviados,
      falhas: totalFalhas,
      status: concluiu ? 'concluido' : 'enviando',
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', disparo.id)

  // Só na virada para concluído: notificar a cada lote encheria o sino de
  // repetição da mesma campanha.
  if (concluiu) {
    const { data: campanha } = await db
      .from('disparos')
      .select('nome, total')
      .eq('id', disparo.id)
      .maybeSingle()

    if (campanha) {
      await registrarNotificacao(db, String(instancia.owner_id), {
        tipo: 'disparo',
        id: disparo.id,
        nome: String(campanha.nome),
        enviados: totalEnviados,
        total: Number(campanha.total),
      })
    }
  }
```

- [ ] **Step 8: Verificar tipos, suíte e build**

Run: `pnpm exec tsc --noEmit && pnpm test:run && pnpm build`
Expected: sem erro; a suíte inteira passa

- [ ] **Step 9: Commit**

```bash
git add lib/notificacoes.ts lib/notificacoes/__tests__/gatilho-conexao.test.ts "app/api/webhooks/evolution/[segredo]/route.ts" lib/disparos/processador.ts
git commit -m "feat: os três produtores passam a notificar

Mensagem recebida e queda de conexão saem do receptor de webhook, campanha
concluída sai do processador. Nenhum deles sabe o que é preferência: só
relatam o que aconteceu.

A queda exige transição vinda de conectada, porque toda instância nasce
fechada e sem isso criar uma conexão avisaria queda antes de o QR ser
lido. Ela também grava o status novo, senão a tela seguiria dizendo
conectada até alguém abrir Conexão.

A campanha notifica só na virada para concluído: a cada lote encheria o
sino de repetição.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: O sino, com entrega ao vivo

**Files:**
- Create: `components/sino-notificacoes.tsx`
- Modify: `components/topbar.tsx:2,35-36` (trocar o botão desabilitado pelo sino)
- Modify: `app/(app)/layout.tsx:28` (passar a lista inicial)
- Test: `components/__tests__/sino-notificacoes.test.tsx`

**Interfaces:**
- Consumes: `Notificacao` de `@/lib/notificacoes`; `marcarComoLida`, `marcarTodasComoLidas` de `@/app/(app)/notificacoes/actions`; `criarClienteNavegador` de `@/lib/supabase/client`; `formatarDataHora` de `@/lib/datas`
- Produces: `<SinoNotificacoes iniciais={Notificacao[]} ownerId={string} />`

- [ ] **Step 1: Escrever o teste que falha**

Criar `components/__tests__/sino-notificacoes.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SinoNotificacoes } from '@/components/sino-notificacoes'
import type { Notificacao } from '@/lib/notificacoes'

const acoes = vi.hoisted(() => ({ lida: vi.fn(), todas: vi.fn() }))
const navegacao = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => navegacao,
}))

vi.mock('@/app/(app)/notificacoes/actions', () => ({
  marcarComoLida: (id: string) => acoes.lida(id),
  marcarTodasComoLidas: () => acoes.todas(),
}))

// O canal do Realtime não sobe no jsdom; o teste cobre a lista inicial e as
// interações, e a entrega ao vivo fica para a verificação manual.
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

function nota(sobrepor: Partial<Notificacao> = {}): Notificacao {
  return {
    id: 'n1',
    tipo: 'mensagem',
    titulo: 'Amanda respondeu',
    corpo: 'Oi, tudo bem?',
    destino: '/mensagens?busca=556584627628',
    lida: false,
    quando: '2026-08-20T13:00:00.000Z',
    ...sobrepor,
  }
}

beforeEach(() => {
  acoes.lida.mockResolvedValue({ ok: true })
  acoes.todas.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('contador', () => {
  it('mostra quantas não lidas existem', () => {
    render(
      <SinoNotificacoes
        ownerId="user-1"
        iniciais={[nota(), nota({ id: 'n2' })]}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('não mostra contador quando está tudo lido', () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota({ lida: true })]} />)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('passa de nove vira 9+, para não deformar o sino', () => {
    const muitas = Array.from({ length: 12 }, (_, i) => nota({ id: `n${i}` }))
    render(<SinoNotificacoes ownerId="user-1" iniciais={muitas} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })
})

describe('painel', () => {
  it('lista título e corpo ao abrir', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota()]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))

    expect(await screen.findByText('Amanda respondeu')).toBeInTheDocument()
    expect(screen.getByText('Oi, tudo bem?')).toBeInTheDocument()
  })

  it('sem nenhuma, explica em vez de ficar vazio', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))

    expect(await screen.findByText(/Nenhuma notificação/)).toBeInTheDocument()
  })

  it('clicar marca como lida e navega para o destino', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota()]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    await userEvent.click(await screen.findByText('Amanda respondeu'))

    await waitFor(() => expect(acoes.lida).toHaveBeenCalledWith('n1'))
    expect(navegacao.push).toHaveBeenCalledWith('/mensagens?busca=556584627628')
  })

  it('marcar todas zera o contador', async () => {
    render(
      <SinoNotificacoes
        ownerId="user-1"
        iniciais={[nota(), nota({ id: 'n2' })]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: /Marcar todas como lidas/ }),
    )

    await waitFor(() => expect(acoes.todas).toHaveBeenCalled())
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('sem nada não lido, não oferece marcar todas', async () => {
    render(<SinoNotificacoes ownerId="user-1" iniciais={[nota({ lida: true })]} />)
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }))

    await screen.findByText('Amanda respondeu')
    expect(
      screen.queryByRole('button', { name: /Marcar todas como lidas/ }),
    ).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm exec vitest run components/__tests__/sino-notificacoes.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/sino-notificacoes"`

- [ ] **Step 3: Escrever `components/sino-notificacoes.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, MessageCircle, Send, Wifi } from 'lucide-react'
import {
  marcarComoLida,
  marcarTodasComoLidas,
} from '@/app/(app)/notificacoes/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatarDataHora } from '@/lib/datas'
import type { Notificacao, TipoNotificacao } from '@/lib/notificacoes'
import { criarClienteNavegador } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const ICONE: Record<TipoNotificacao, typeof Bell> = {
  mensagem: MessageCircle,
  disparo: Send,
  conexao: Wifi,
}

/** Acima disso o número deforma o sino. */
const TETO_CONTADOR = 9

export function SinoNotificacoes({
  iniciais,
  ownerId,
}: {
  iniciais: Notificacao[]
  ownerId: string
}) {
  const router = useRouter()

  // A lista do servidor é a verdade; o local guarda só quais foram lidas
  // agora, para o item riscar na hora sem esperar a ação voltar.
  //
  // Derivar em vez de copiar com useEffect é proposital: `iniciais` chega como
  // array novo a cada render, e sincronizar por efeito entraria em laço.
  const [lidasAgora, setLidasAgora] = useState<string[]>([])

  const lista = iniciais.map((n) =>
    lidasAgora.includes(n.id) ? { ...n, lida: true } : n,
  )

  // Realtime: o canal entrega a linha nova sem recarregar. Caindo, a lista
  // inicial continua correta e se atualiza na próxima navegação.
  useEffect(() => {
    const supabase = criarClienteNavegador()

    const canal = supabase
      .channel(`notificacoes:${ownerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `owner_id=eq.${ownerId}`,
        },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [ownerId, router])

  const naoLidas = lista.filter((n) => !n.lida).length

  async function abrir(notificacao: Notificacao) {
    setLidasAgora((atual) => [...atual, notificacao.id])
    await marcarComoLida(notificacao.id)
    if (notificacao.destino) router.push(notificacao.destino)
  }

  async function lerTodas() {
    setLidasAgora(iniciais.map((n) => n.id))
    await marcarTodasComoLidas()
  }

  return (
    <DropdownMenu>
      {/* Sem render de Button: o gatilho já renderiza um <button>, e passar
          outro pelo render foi o que gerou aviso do Base UI no menu da conta. */}
      <DropdownMenuTrigger
        aria-label={`Notificações${naoLidas > 0 ? `, ${naoLidas} não lidas` : ''}`}
        className="relative flex size-8 items-center justify-center rounded-full border border-border bg-background outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-4" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {naoLidas > TETO_CONTADOR ? `${TETO_CONTADOR}+` : naoLidas}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium text-foreground">Notificações</span>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1.5 text-xs"
              onClick={lerTodas}
            >
              <CheckCheck className="size-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {lista.length === 0 ? (
          <p className="px-3 pb-4 pt-2 text-center text-sm text-muted-foreground">
            Nenhuma notificação por aqui. Mensagem recebida, campanha concluída e
            queda de conexão aparecem neste painel.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto border-t border-border">
            {lista.map((n) => {
              const Icone = ICONE[n.tipo]
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => abrir(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                      !n.lida && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                        n.lida
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/15 text-primary',
                      )}
                    >
                      <Icone className="size-3.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {n.titulo}
                        </span>
                        {!n.lida && (
                          <Badge className="size-1.5 shrink-0 rounded-full bg-primary p-0" />
                        )}
                      </span>
                      {n.corpo && (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {n.corpo}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatarDataHora(n.quando)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `pnpm exec vitest run components/__tests__/sino-notificacoes.test.tsx`
Expected: PASS — 8 testes

- [ ] **Step 5: Trocar o botão desabilitado pelo sino**

Em `components/topbar.tsx`, remover `Bell` do import de `lucide-react` (deixando `Send`), acrescentar:

```ts
import { SinoNotificacoes } from '@/components/sino-notificacoes'
import type { Notificacao } from '@/lib/notificacoes'
```

Trocar a assinatura:

```tsx
export function Topbar({
  nome,
  email,
  ownerId,
  notificacoes,
}: {
  nome: string
  email: string
  ownerId: string
  notificacoes: Notificacao[]
}) {
```

E substituir todo o bloco do `<Button ... aria-label="Notificações (disponível na Entrega 2)" ... disabled>` por:

```tsx
        <SinoNotificacoes iniciais={notificacoes} ownerId={ownerId} />
```

- [ ] **Step 6: Ligar no layout**

Em `app/(app)/layout.tsx`, acrescentar ao topo:

```ts
import { listarNotificacoes } from '@/lib/consultas/notificacoes'
```

Depois de `const nome = await nomeDoPerfil()`:

```ts
  const notificacoes = await listarNotificacoes()
```

E trocar a chamada da topbar:

```tsx
          <Topbar
            nome={nome}
            email={usuario.email ?? ''}
            ownerId={usuario.id}
            notificacoes={notificacoes}
          />
```

- [ ] **Step 7: Verificar tipos, suíte e build**

Run: `pnpm exec tsc --noEmit && pnpm test:run && pnpm build`
Expected: sem erro; a suíte inteira passa

- [ ] **Step 8: Commit**

```bash
git add components/sino-notificacoes.tsx components/__tests__/sino-notificacoes.test.tsx components/topbar.tsx "app/(app)/layout.tsx"
git commit -m "feat: sino de notificações com entrega ao vivo

O botão desabilitado da topbar vira painel de verdade. A lista inicial vem
do servidor, então o primeiro render já mostra o certo sem esperar rede, e
o canal do Realtime cobre o que chega depois. Caindo o canal, a lista
continua correta e se atualiza na navegação seguinte.

Clicar marca como lida na hora, no estado local, antes de a ação voltar:
esperar o servidor para riscar um item deixa o painel com cara de travado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Preferências que gravam

**Files:**
- Modify: `app/(app)/configuracoes/preferencias.tsx` (todo o card de Notificações)
- Modify: `app/(app)/configuracoes/actions.ts` (acrescentar ação ao final)
- Modify: `app/(app)/configuracoes/page.tsx` (buscar e passar as preferências)
- Create: `lib/consultas/preferencias.ts`
- Test: `app/(app)/configuracoes/__tests__/preferencias.test.ts`

**Interfaces:**
- Consumes: `PREFERENCIA_POR_TIPO`, `TipoNotificacao` de `@/lib/notificacoes`
- Produces:
  - `type Preferencias = { notificar_mensagem: boolean; notificar_disparo: boolean; notificar_conexao: boolean }`
  - `buscarPreferencias(): Promise<Preferencias>` em `lib/consultas/preferencias.ts`
  - `salvarPreferencia(tipo: TipoNotificacao, ligado: boolean): Promise<{ erro?: string; ok?: boolean }>` em `app/(app)/configuracoes/actions.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `app/(app)/configuracoes/__tests__/preferencias.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { salvarPreferencia } from '@/app/(app)/configuracoes/actions'

const banco = vi.hoisted(() => ({
  usuario: { id: 'user-1' } as { id: string } | null,
  erro: null as { message: string } | null,
  updates: [] as Record<string, unknown>[],
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: banco.usuario } }) },
    from: () => ({
      update: (valores: Record<string, unknown>) => ({
        eq: async (_coluna: string, id: string) => {
          banco.updates.push({ valores, id })
          return { error: banco.erro }
        },
      }),
    }),
  }),
}))

beforeEach(() => {
  banco.usuario = { id: 'user-1' }
  banco.erro = null
  banco.updates = []
})

describe('salvarPreferencia', () => {
  it('grava na coluna do tipo escolhido', async () => {
    const estado = await salvarPreferencia('mensagem', false)

    expect(estado).toEqual({ ok: true })
    expect(banco.updates[0]).toEqual({
      valores: { notificar_mensagem: false },
      id: 'user-1',
    })
  })

  it('cada tipo tem a sua coluna', async () => {
    await salvarPreferencia('disparo', true)
    await salvarPreferencia('conexao', false)

    expect(banco.updates[0].valores).toEqual({ notificar_disparo: true })
    expect(banco.updates[1].valores).toEqual({ notificar_conexao: false })
  })

  // O tipo vem da tela; aceitar qualquer string viraria nome de coluna.
  it('recusa tipo desconhecido sem tocar no banco', async () => {
    const estado = await salvarPreferencia(
      'invalido' as never,
      true,
    )

    expect(estado.erro).toMatch(/desconhecido/)
    expect(banco.updates).toHaveLength(0)
  })

  it('recusa quando não há sessão', async () => {
    banco.usuario = null
    const estado = await salvarPreferencia('mensagem', true)

    expect(estado.erro).toMatch(/Sessão expirada/)
    expect(banco.updates).toHaveLength(0)
  })

  it('reporta falha do banco sem vazar a mensagem interna', async () => {
    banco.erro = { message: 'violates row-level security policy' }
    const estado = await salvarPreferencia('mensagem', true)

    expect(estado.erro).toBe('Não foi possível salvar a preferência.')
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm exec vitest run "app/(app)/configuracoes/__tests__/preferencias.test.ts"`
Expected: FAIL — `salvarPreferencia is not a function`

- [ ] **Step 3: Acrescentar a ação em `app/(app)/configuracoes/actions.ts`**

Acrescentar ao topo do arquivo:

```ts
import { PREFERENCIA_POR_TIPO, type TipoNotificacao } from '@/lib/notificacoes'
```

E ao final:

```ts
export type EstadoPreferencia = { erro?: string; ok?: boolean }

/**
 * Liga ou desliga um tipo de notificação.
 *
 * O tipo vira nome de coluna, então a validação contra PREFERENCIA_POR_TIPO
 * não é formalidade: sem ela, uma string da tela viraria identificador SQL.
 */
export async function salvarPreferencia(
  tipo: TipoNotificacao,
  ligado: boolean,
): Promise<EstadoPreferencia> {
  const coluna = PREFERENCIA_POR_TIPO[tipo]
  if (!coluna) return { erro: 'Tipo de notificação desconhecido.' }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { error } = await supabase
    .from('profiles')
    .update({ [coluna]: ligado })
    .eq('id', user.id)

  if (error) return { erro: 'Não foi possível salvar a preferência.' }

  revalidatePath('/configuracoes')
  return { ok: true }
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `pnpm exec vitest run "app/(app)/configuracoes/__tests__/preferencias.test.ts"`
Expected: PASS — 5 testes

- [ ] **Step 5: Escrever `lib/consultas/preferencias.ts`**

```ts
import { criarClienteServidor } from '@/lib/supabase/server'

export type Preferencias = {
  notificar_mensagem: boolean
  notificar_disparo: boolean
  notificar_conexao: boolean
}

/** Padrão de quem ainda não mexeu, e de antes da migration 0012. */
const TUDO_LIGADO: Preferencias = {
  notificar_mensagem: true,
  notificar_disparo: true,
  notificar_conexao: true,
}

export async function buscarPreferencias(): Promise<Preferencias> {
  const supabase = await criarClienteServidor()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return TUDO_LIGADO

  const { data, error } = await supabase
    .from('profiles')
    .select('notificar_mensagem, notificar_disparo, notificar_conexao')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return TUDO_LIGADO

  return {
    notificar_mensagem: data.notificar_mensagem !== false,
    notificar_disparo: data.notificar_disparo !== false,
    notificar_conexao: data.notificar_conexao !== false,
  }
}
```

- [ ] **Step 6: Reescrever o card de Notificações**

Em `app/(app)/configuracoes/preferencias.tsx`, substituir a constante `notificacoes` e a assinatura do componente:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Preferencias as PreferenciasSalvas } from '@/lib/consultas/preferencias'
import type { TipoNotificacao } from '@/lib/notificacoes'
import { salvarPreferencia } from './actions'

const NOTIFICACOES: {
  tipo: TipoNotificacao
  chave: keyof PreferenciasSalvas
  label: string
  desc: string
}[] = [
  {
    tipo: 'mensagem',
    chave: 'notificar_mensagem',
    label: 'Novas mensagens',
    desc: 'Receber alerta a cada nova conversa',
  },
  {
    tipo: 'disparo',
    chave: 'notificar_disparo',
    label: 'Status de disparos',
    desc: 'Notificar ao concluir uma campanha',
  },
  {
    tipo: 'conexao',
    chave: 'notificar_conexao',
    label: 'Queda de conexão',
    desc: 'Avisar quando uma instância cair',
  },
]

export function Preferencias({
  preferencias,
}: {
  preferencias: PreferenciasSalvas
}) {
  const [valores, setValores] = useState(preferencias)
  const [salvando, iniciarSalvamento] = useTransition()
  const [erro, setErro] = useState('')

  function alternar(
    tipo: TipoNotificacao,
    chave: keyof PreferenciasSalvas,
    ligado: boolean,
  ) {
    setErro('')
    // Move na hora e desfaz se falhar: preferência é interruptor, não
    // formulário — esperar o servidor para reagir parece travado.
    setValores((atual) => ({ ...atual, [chave]: ligado }))

    iniciarSalvamento(async () => {
      const resultado = await salvarPreferencia(tipo, ligado)
      if (resultado.erro) {
        setValores((atual) => ({ ...atual, [chave]: !ligado }))
        setErro(resultado.erro)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Alterne entre modo claro e escuro</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-foreground">Tema da interface</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações</CardTitle>
          <CardDescription>
            Escolha o que aparece no sino. Desligado, a notificação não chega a
            ser criada.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {NOTIFICACOES.map((n) => (
            <div key={n.tipo} className="flex items-center justify-between gap-4">
              <div>
                <Label
                  htmlFor={n.tipo}
                  className="text-sm font-medium text-foreground"
                >
                  {n.label}
                </Label>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Switch
                id={n.tipo}
                checked={valores[n.chave]}
                disabled={salvando}
                onCheckedChange={(ligado) =>
                  alternar(n.tipo, n.chave, Boolean(ligado))
                }
              />
            </div>
          ))}

          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Passar as preferências pela página**

Em `app/(app)/configuracoes/page.tsx`, acrescentar ao topo:

```ts
import { buscarPreferencias } from '@/lib/consultas/preferencias'
```

Acrescentar `buscarPreferencias()` ao `Promise.all` existente:

```ts
  const [usuario, nome, etiquetas, preferencias] = await Promise.all([
    usuarioLogado(),
    nomeDoPerfil(),
    listarEtiquetas(),
    buscarPreferencias(),
  ])
```

E trocar `<Preferencias />` por:

```tsx
      <Preferencias preferencias={preferencias} />
```

- [ ] **Step 8: Verificar tipos, suíte e build**

Run: `pnpm exec tsc --noEmit && pnpm test:run && pnpm build`
Expected: sem erro; a suíte inteira passa

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/configuracoes/preferencias.tsx" "app/(app)/configuracoes/actions.ts" "app/(app)/configuracoes/page.tsx" lib/consultas/preferencias.ts "app/(app)/configuracoes/__tests__/preferencias.test.ts"
git commit -m "feat: preferências de notificação que gravam

Os três interruptores eram decorativos, com defaultChecked e sem
persistência. Agora gravam ao alternar, sem botão de salvar: é
preferência, não formulário.

O interruptor move na hora e desfaz se o servidor recusar — esperar a
resposta para reagir dá impressão de travado.

O tipo vira nome de coluna, então a validação contra PREFERENCIA_POR_TIPO
não é formalidade: sem ela uma string da tela viraria identificador SQL.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Fechamento — documentação e verificação manual

**Files:**
- Modify: `docs/FAZER-AGORA.md` (acrescentar o passo da migration 0012)
- Modify: `docs/superpowers/specs/2026-08-20-notificacoes-design.md` (marcar entregue)
- Modify: `README.md` (linha da tabela de telas e o estado do projeto)

- [ ] **Step 1: Rodar a suíte inteira e o build**

Run: `pnpm exec tsc --noEmit && pnpm test:run && pnpm build`
Expected: tudo passa

- [ ] **Step 2: Acrescentar o passo da migration ao FAZER-AGORA**

Em `docs/FAZER-AGORA.md`, logo após o passo 0c, acrescentar:

```markdown
---

## Passo 0d — Rodar a migration 0012

**Onde:** Supabase → SQL Editor. Cole o conteúdo de
`supabase/migrations/0012_notificacoes.sql`.

Cria a tabela de notificações, publica ela no Realtime e acrescenta as três
preferências ao perfil.

O `alter publication supabase_realtime add table` é a linha que mais importa:
sem ela o sino funciona, mas só atualiza quando você troca de tela. Não dá
erro — simplesmente não chega nada ao vivo.
```

- [ ] **Step 3: Percorrer o fluxo manualmente**

Com a migration rodada e o deploy no ar:

1. Abrir o painel e conferir que o sino aparece sem contador
2. Mandar mensagem de outro celular para o número conectado
3. **Sem recarregar**, o contador deve subir sozinho — é isso que prova o Realtime
4. Abrir o painel: a notificação traz nome e prévia
5. Clicar: vai para Mensagens com a busca preenchida, e o contador cai
6. Em Configurações, desligar "Novas mensagens"
7. Mandar outra mensagem: a conversa aparece em Mensagens, mas **nenhuma** notificação
8. Religar e conferir que volta a notificar

- [ ] **Step 4: Atualizar o README**

Na tabela das sete telas, trocar a linha de Configurações por:

```markdown
| `/configuracoes` | Perfil real do Supabase, tema e preferências de notificação |
```

E na seção "Estado", acrescentar ao final:

```markdown
O sino da topbar avisa ao vivo sobre mensagem recebida, campanha concluída e
queda de conexão, pelo Realtime do Supabase. Cada tipo é controlado pelo seu
interruptor em Configurações, e desligado significa não criar.
```

- [ ] **Step 5: Marcar a spec como entregue**

Em `docs/superpowers/specs/2026-08-20-notificacoes-design.md`, trocar
`**Status:** aprovada` por `**Status:** entregue em 2026-XX-XX` com a data real.

- [ ] **Step 6: Commit e push**

```bash
git add docs README.md
git commit -m "docs: fechamento das notificações

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin feat/fundacao:main
```

---

## Auto-revisão

**Cobertura da spec** — cada seção tem tarefa correspondente:

| Seção da spec | Tarefa |
|---|---|
| Modelo de dados, chave, índice, RLS, Realtime, preferências | Task 1 |
| Produtores: ponto único, portão de preferência | Task 2 |
| Produtores: os três gatilhos, condição da queda | Task 4 |
| Entrega ao vivo: lista inicial, canal, contador, clicar, marcar todas, vazio | Tasks 3 e 5 |
| Preferências gravando, desligado não cria | Task 6 |
| Retenção de 30 dias sem cron | Task 2 |
| Testes automatizados | Tasks 1, 2, 3, 4, 5, 6 |
| Verificação manual do Realtime | Task 7 |

**Consistência de tipos** — `montarNotificacao` devolve `NotificacaoMontada`
(Task 1), consumido por `registrarNotificacao` (Task 2). `Notificacao` (Task 1)
é produzido por `listarNotificacoes` (Task 3) e consumido por
`SinoNotificacoes` (Task 5). `TipoNotificacao` (Task 1) é usado por
`salvarPreferencia` (Task 6) e pelo mapa de ícones (Task 5).
`PREFERENCIA_POR_TIPO` (Task 1) é usado nas Tasks 2 e 6, sempre com as mesmas
três chaves.

**Riscos conhecidos, já tratados no plano:**

- Índice parcial em `ON CONFLICT` falha com 42P10 — a Task 1 usa restrição completa e o comentário diz por quê
- Componente de cliente importando módulo de servidor quebra o build — `lib/notificacoes.ts` não importa nada de servidor; só `lib/notificacoes/registrar.ts` importa, e ele é de servidor
- `alter publication` esquecido faz o Realtime falhar em silêncio — está na migration e no roteiro manual da Task 7
