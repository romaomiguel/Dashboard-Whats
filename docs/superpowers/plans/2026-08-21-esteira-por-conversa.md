# Esteira por Conversa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a unidade do funil de contato para conversa, inscrever automaticamente quem troca mensagem, promover sozinho quem responde, e substituir o `<select>` por arrastar-e-soltar com busca.

**Architecture:** Uma tabela `funil`, com uma linha por `(dono, chave canônica do número)`, passa a ser a unidade. O webhook e o envio pela plataforma chamam um registrador comum que inscreve na etapa de papel `entrada` e promove para a de papel `respondeu` quando chega mensagem recebida. A decisão de mover é uma função pura, testada isolada; a gravação é uma camada fina em volta. A tela lê etapas mais linhas do funil e resolve o nome de exibição em memória, como `listarConversas` já faz.

**Tech Stack:** Next.js 16.3 (App Router), TypeScript, Supabase (Postgres + RLS), `@dnd-kit/core` + `@dnd-kit/sortable`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-esteira-por-conversa-design.md` — leia antes de começar. Este plano argumenta a partir dele; conflito entre os dois se resolve pelo spec.

## Global Constraints

- **Comentários em português**, explicando *por que*, no estilo do repo. Nunca comentar o óbvio.
- **TDD**: teste falhando antes da implementação.
- **Verificação enxuta, por instrução explícita do usuário:** cada task roda **apenas o arquivo de teste que ela tocou**. **Não** rode `npm run test:run` nem `npx tsc --noEmit` no meio do plano. A verificação completa acontece uma vez só, na seção "Verificação final".
- **Agrupamento de número sempre por `chaveDoNumero`** (`lib/numeros.ts`). Comparar número cru separa a mesma pessoa em duas conversas.
- **RLS por `owner_id`** em toda tabela nova, no padrão de `0009_desempenho.sql`: `for all to authenticated using (owner_id = (select auth.uid())) with check (...)`.
- **Ler `node_modules/next/dist/docs/`** antes de mexer em rota, página ou server action — o `AGENTS.md` exige.
- **A migration 0015 não é aplicada por nenhuma task.** O usuário aplica no SQL Editor. Nenhuma task roda `curl` ou CLI contra o Supabase dele.
- Commits frequentes, um por task, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Decisões já tomadas (não reabrir)

1. **Conversa é a unidade, não contato.** `contatos` é único pelo número cru e as duas pontas gravam formas diferentes; inscrever lá duplicaria a pessoa. Ver o spec.
2. **Papel marcado na etapa**, não inferido por ordem ou nome.
3. **Promoção é de mão única:** só de `entrada` para `respondeu`, só em mensagem recebida. Quem já está em "Negociando" nunca volta.
4. **Sem coluna "Sem etapa".** Toda linha nasce numa etapa; linha órfã (etapa apagada) é re-alocada na entrada.
5. **`renomearEtapa` continua não existindo.**

---

## Estrutura de arquivos

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0015_funil.sql` | `funil`, `funil_historico`, `etapas.papel`; remove o funil-por-contato da 0014 |
| `lib/funil.ts` | Domínio puro: papéis e a decisão de movimento |
| `lib/funil/registrar.ts` | Grava a decisão: inscreve, promove, historia |
| `app/(app)/esteira/arraste.ts` | Função pura que lê o evento do dnd-kit |

**Modificados:** `lib/esteira.ts`, `lib/consultas/esteira.ts`, `app/(app)/esteira/actions.ts`, `app/(app)/esteira/quadro.tsx`, `app/(app)/esteira/page.tsx`, `app/api/webhooks/evolution/[segredo]/route.ts`, `app/(app)/mensagens/actions.ts`, `package.json`.

**Removidos:** nada em disco; a 0015 remove `contatos.etapa_id` e `contato_etapa_historico` no banco.

---

### Task 1: Papéis e a decisão de movimento

**Files:**
- Create: `supabase/migrations/0015_funil.sql`
- Create: `lib/funil.ts`
- Test: `lib/__tests__/funil.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type Papel = 'entrada' | 'respondeu'`, `type Movimento = { tipo: 'nada' } | { tipo: 'alocar'; etapaId: string } | { tipo: 'promover'; etapaId: string }`, `decidirMovimento(entrada: EntradaDaDecisao): Movimento`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/__tests__/funil.test.ts
import { describe, expect, it } from 'vitest'
import { decidirMovimento } from '@/lib/funil'

const papeis = { etapaEntradaId: 'e-novo', etapaRespondeuId: 'e-conversa' }

describe('decidirMovimento', () => {
  // Um disparo para 300 pessoas tem de nascer como 300 cards em "Novo".
  it('aloca conversa nova na etapa de entrada, venha de onde vier', () => {
    expect(
      decidirMovimento({ existe: false, etapaAtualId: null, direcao: 'saida', ...papeis }),
    ).toEqual({ tipo: 'alocar', etapaId: 'e-novo' })

    expect(
      decidirMovimento({ existe: false, etapaAtualId: null, direcao: 'entrada', ...papeis }),
    ).toEqual({ tipo: 'alocar', etapaId: 'e-novo' })
  })

  it('promove quem respondeu, saindo da entrada', () => {
    expect(
      decidirMovimento({ existe: true, etapaAtualId: 'e-novo', direcao: 'entrada', ...papeis }),
    ).toEqual({ tipo: 'promover', etapaId: 'e-conversa' })
  })

  // A regra que protege o trabalho manual: sem ela, qualquer mensagem
  // arrastaria de volta para "Em conversa" quem já foi para "Negociando".
  it('não mexe em quem já passou da entrada', () => {
    expect(
      decidirMovimento({
        existe: true,
        etapaAtualId: 'e-negociando',
        direcao: 'entrada',
        ...papeis,
      }),
    ).toEqual({ tipo: 'nada' })
  })

  it('mensagem enviada não promove ninguém', () => {
    expect(
      decidirMovimento({ existe: true, etapaAtualId: 'e-novo', direcao: 'saida', ...papeis }),
    ).toEqual({ tipo: 'nada' })
  })

  // Etapa apagada deixa `etapa_id` nulo. Sem a coluna "Sem etapa", esse
  // card não teria onde aparecer e sumiria do quadro.
  it('devolve para a entrada a linha que ficou órfã', () => {
    expect(
      decidirMovimento({ existe: true, etapaAtualId: null, direcao: 'saida', ...papeis }),
    ).toEqual({ tipo: 'alocar', etapaId: 'e-novo' })
  })

  // Nunca inventar etapa: sem papel marcado, a automação fica quieta.
  it('não faz nada sem etapa de entrada marcada', () => {
    expect(
      decidirMovimento({
        existe: false,
        etapaAtualId: null,
        direcao: 'entrada',
        etapaEntradaId: null,
        etapaRespondeuId: 'e-conversa',
      }),
    ).toEqual({ tipo: 'nada' })
  })

  it('não promove sem etapa de respondeu marcada', () => {
    expect(
      decidirMovimento({
        existe: true,
        etapaAtualId: 'e-novo',
        direcao: 'entrada',
        etapaEntradaId: 'e-novo',
        etapaRespondeuId: null,
      }),
    ).toEqual({ tipo: 'nada' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/__tests__/funil.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/funil"`

- [ ] **Step 3: Implementar o domínio**

```ts
// lib/funil.ts

/** O que a automação procura numa etapa, em vez do nome dela. */
export type Papel = 'entrada' | 'respondeu'

export const PAPEIS: readonly Papel[] = ['entrada', 'respondeu'] as const

export type EntradaDaDecisao = {
  existe: boolean
  etapaAtualId: string | null
  direcao: 'entrada' | 'saida'
  etapaEntradaId: string | null
  etapaRespondeuId: string | null
}

export type Movimento =
  | { tipo: 'nada' }
  | { tipo: 'alocar'; etapaId: string }
  | { tipo: 'promover'; etapaId: string }

/**
 * O que fazer com a conversa quando uma mensagem é gravada.
 *
 * Separado da gravação de propósito: são sete regras que se contradizem
 * facilmente, e testá-las contra um banco de mentira esconderia justamente
 * a que importa — a de não mexer em quem já passou da entrada.
 */
export function decidirMovimento({
  existe,
  etapaAtualId,
  direcao,
  etapaEntradaId,
  etapaRespondeuId,
}: EntradaDaDecisao): Movimento {
  // Conversa nova, ou linha que ficou sem etapa porque a etapa foi apagada:
  // as duas precisam de casa, e a casa é a entrada.
  if (!existe || etapaAtualId === null) {
    return etapaEntradaId ? { tipo: 'alocar', etapaId: etapaEntradaId } : { tipo: 'nada' }
  }

  // Promover é de mão única: só sai da entrada, e só porque o contato
  // respondeu. Daí em diante quem move é o usuário.
  const respondeu = direcao === 'entrada'
  if (respondeu && etapaAtualId === etapaEntradaId && etapaRespondeuId) {
    return { tipo: 'promover', etapaId: etapaRespondeuId }
  }

  return { tipo: 'nada' }
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/__tests__/funil.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 5: Escrever a migration**

```sql
-- supabase/migrations/0015_funil.sql

-- Papel da etapa: o que a automação procura, em vez do nome.
--
-- Casar pelo texto "Em conversa" faria renomear a etapa quebrar a promoção
-- em silêncio. O papel acompanha a etapa, o nome é livre.
alter table public.etapas
  add column papel text
  constraint papel_valido check (papel in ('entrada', 'respondeu'));

-- Um papel por dono: duas etapas de entrada deixariam a automação escolher
-- ao acaso para onde mandar as conversas novas.
create unique index etapas_papel_unico
  on public.etapas (owner_id, papel)
  where papel is not null;

-- O funil passa a ser por conversa, não por contato.
--
-- `contatos` é único pelo número cru, e as duas pontas gravam formas
-- diferentes da mesma pessoa: o cadastro com o nono dígito, o webhook sem.
-- Inscrever pelo webhook na tabela de contatos duplicaria o cliente. A
-- chave canônica resolve, e faz a esteira e a tela de conversa concordarem
-- sobre quem é quem.
create table public.funil (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  chave_numero  text not null,
  numero        text not null,
  etapa_id      uuid references public.etapas(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint conversa_unica_por_usuario unique (owner_id, chave_numero)
);

create index funil_owner_idx on public.funil (owner_id, etapa_id);

-- Histórico com o nome da etapa congelado em texto: renomear ou apagar uma
-- etapa não pode reescrever o passado. `automatico` separa o que a
-- automação fez do que o usuário fez.
create table public.funil_historico (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  funil_id   uuid not null references public.funil(id) on delete cascade,
  de         text,
  para       text not null,
  automatico boolean not null default false,
  criado_em  timestamptz not null default now()
);

create index funil_historico_idx
  on public.funil_historico (owner_id, funil_id, criado_em desc);

alter table public.funil enable row level security;
alter table public.funil_historico enable row level security;

create policy proprio_funil on public.funil
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy proprio_funil_historico on public.funil_historico
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- A 0014 pendurou o funil no contato. Com a conversa como unidade estas
-- ficam inalcançáveis. O histórico gravado durante o teste da 0014 se perde
-- junto; aceito, a feature tem horas de vida.
drop table if exists public.contato_etapa_historico;
alter table public.contatos drop column if exists etapa_id;
```

> **Não aplique esta migration.** O usuário roda no SQL Editor. Só commitar o arquivo.

- [ ] **Step 6: Commit**

```bash
git add lib/funil.ts lib/__tests__/funil.test.ts supabase/migrations/0015_funil.sql
git commit -m "feat(funil): papel da etapa e a decisão de movimento"
```

---

### Task 2: Gravar a decisão

**Files:**
- Create: `lib/funil/registrar.ts`
- Test: `lib/funil/__tests__/registrar.test.ts`
- Read first: `lib/notificacoes/registrar.ts` (mesmo formato: cliente admin recebido por parâmetro, nunca derruba quem chamou)

**Interfaces:**
- Consumes: `decidirMovimento`, `Movimento` de `@/lib/funil`; `chaveDoNumero` de `@/lib/numeros`.
- Produces: `registrarNoFunil(admin: ClienteAdmin, dados: { ownerId: string; numero: string; direcao: 'entrada' | 'saida' }): Promise<void>`.

O `admin` é o cliente Supabase que quem chama já tem: o webhook usa o de service role, o envio pela plataforma usa o do servidor. Receber por parâmetro evita a função escolher privilégio por conta própria.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/funil/__tests__/registrar.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarNoFunil } from '@/lib/funil/registrar'

const estado = vi.hoisted(() => ({
  etapas: [] as Record<string, unknown>[],
  linha: null as Record<string, unknown> | null,
  upserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  erroUpsert: null as { code: string; message: string } | null,
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
          return { eq: () => ({ eq: async () => ({ error: null }) }) }
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
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/funil/__tests__/registrar.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/funil/registrar.ts
import { decidirMovimento } from '@/lib/funil'
import { chaveDoNumero } from '@/lib/numeros'

/** O mínimo do cliente Supabase que esta função usa. */
type ClienteAdmin = {
  from: (tabela: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

type Dados = {
  ownerId: string
  numero: string
  direcao: 'entrada' | 'saida'
}

/**
 * Inscreve a conversa no funil e promove quem respondeu.
 *
 * Nunca estoura: quem chama é o webhook e o envio, e os dois têm trabalho
 * mais importante que este. Falha aqui vira log.
 */
export async function registrarNoFunil(admin: ClienteAdmin, dados: Dados): Promise<void> {
  try {
    const chave = chaveDoNumero(dados.numero)

    const { data: etapas } = await admin
      .from('etapas')
      .select('id, nome, papel')
      .eq('owner_id', dados.ownerId)
      .not('papel', 'is', null)

    const papeis = (etapas ?? []) as { id: string; nome: string; papel: string }[]
    const entrada = papeis.find((e) => e.papel === 'entrada') ?? null
    const respondeu = papeis.find((e) => e.papel === 'respondeu') ?? null

    const { data: linha } = await admin
      .from('funil')
      .select('id, etapa_id, etapas(nome)')
      .eq('owner_id', dados.ownerId)
      .eq('chave_numero', chave)
      .maybeSingle()

    const atual = linha as { id: string; etapa_id: string | null; etapas?: { nome?: string } } | null

    const movimento = decidirMovimento({
      existe: Boolean(atual),
      etapaAtualId: atual?.etapa_id ?? null,
      direcao: dados.direcao,
      etapaEntradaId: entrada?.id ?? null,
      etapaRespondeuId: respondeu?.id ?? null,
    })

    if (movimento.tipo === 'nada') return

    if (movimento.tipo === 'alocar') {
      // Upsert e não insert: duas mensagens da mesma conversa podem chegar
      // ao mesmo tempo, e o índice único resolve sem virar erro.
      const { error } = await admin.from('funil').upsert(
        {
          owner_id: dados.ownerId,
          chave_numero: chave,
          // A forma vista agora: é o número que o card mostra e linka.
          numero: dados.numero,
          etapa_id: movimento.etapaId,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'owner_id,chave_numero' },
      )

      if (error) console.error('[funil] não inscreveu:', error.code, error.message)
      return
    }

    await admin
      .from('funil')
      .update({
        etapa_id: movimento.etapaId,
        numero: dados.numero,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', atual!.id)
      .eq('owner_id', dados.ownerId)

    const { error: erroHistorico } = await admin.from('funil_historico').insert({
      owner_id: dados.ownerId,
      funil_id: atual!.id,
      de: atual?.etapas?.nome ?? null,
      para: respondeu?.nome ?? '',
      automatico: true,
    })

    if (erroHistorico) {
      console.error('[funil] histórico não gravou:', erroHistorico.code, erroHistorico.message)
    }
  } catch (causa) {
    console.error('[funil] registrar falhou:', causa)
  }
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/funil/__tests__/registrar.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/funil/registrar.ts lib/funil/__tests__/registrar.test.ts
git commit -m "feat(funil): inscreve e promove a conversa ao gravar mensagem"
```

---

### Task 3: Webhook e envio chamam o registrador

**Files:**
- Modify: `app/api/webhooks/evolution/[segredo]/route.ts` (logo depois do upsert em `mensagens`)
- Modify: `app/(app)/mensagens/actions.ts` (depois do upsert de saída)
- Test: `app/api/webhooks/evolution/[segredo]/__tests__/route.test.ts` (existe) e `app/(app)/mensagens/__tests__/actions.test.ts` (existe)

**Interfaces:**
- Consumes: `registrarNoFunil` de `@/lib/funil/registrar`.
- Produces: nada novo.

- [ ] **Step 1: Localizar os dois pontos de chamada**

Run: `grep -n "from('mensagens')" "app/api/webhooks/evolution/[segredo]/route.ts" "app/(app)/mensagens/actions.ts"`

No webhook, o ponto é logo após o `if (error) { console.error(...) }` do upsert em `mensagens`. Em `enviarMensagem`, é logo após o upsert e antes dos `revalidatePath`.

- [ ] **Step 2: Escrever o teste falhando**

Acrescente a `app/(app)/mensagens/__tests__/actions.test.ts`, dentro do `describe('enviarMensagem')` que já existe:

```ts
  // Responder alguém novo pela plataforma tem de criar o card, senão a
  // conversa existe na tela de Mensagens e não existe no funil.
  it('inscreve a conversa no funil ao enviar', async () => {
    await enviarMensagem('556584038479', 'Olá')

    expect(funil.registrar).toHaveBeenCalledWith(expect.anything(), {
      ownerId: 'user-1',
      numero: '556584038479',
      direcao: 'saida',
    })
  })
```

E, no topo do mesmo arquivo, junto dos outros mocks:

```ts
const funil = vi.hoisted(() => ({ registrar: vi.fn() }))

vi.mock('@/lib/funil/registrar', () => ({
  registrarNoFunil: (...args: unknown[]) => funil.registrar(...args),
}))
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/mensagens/__tests__/actions.test.ts'`
Expected: FAIL — `funil.registrar` não foi chamado.

- [ ] **Step 4: Ligar nos dois lugares**

Em `app/(app)/mensagens/actions.ts`, depois do upsert e antes dos `revalidatePath`:

```ts
  // Inscreve a conversa no funil. Falha aqui não pode derrubar um envio que
  // já saiu — o próprio registrador engole o erro.
  await registrarNoFunil(supabase, {
    ownerId: user.id,
    numero,
    direcao: 'saida',
  })
```

No webhook, depois do bloco de erro do upsert em `mensagens`:

```ts
  // O funil acompanha a conversa: mensagem enviada ou recebida inscreve, e
  // só a recebida promove. O registrador nunca estoura, então o webhook
  // continua respondendo mesmo se o funil falhar.
  await registrarNoFunil(admin, {
    ownerId: instancia.owner_id,
    numero,
    direcao: daPropriaConta ? 'saida' : 'entrada',
  })
```

Acrescente o import `import { registrarNoFunil } from '@/lib/funil/registrar'` nos dois arquivos.

- [ ] **Step 5: Cobrir o lado do webhook**

Acrescente a `app/api/webhooks/evolution/[segredo]/__tests__/route.test.ts`, seguindo os mocks que o arquivo já usa:

```ts
const funil = vi.hoisted(() => ({ registrar: vi.fn() }))

vi.mock('@/lib/funil/registrar', () => ({
  registrarNoFunil: (...args: unknown[]) => funil.registrar(...args),
}))
```

E dois testes:

```ts
  // Quem te escreve entra no funil mesmo sem estar em Contatos — é o caso
  // que a esteira por contato não cobria.
  it('inscreve a conversa recebida no funil', async () => {
    await postar(eventoDeMensagemRecebida())

    expect(funil.registrar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ direcao: 'entrada' }),
    )
  })

  // O eco `fromMe` da própria conta é saída: inscreve, mas não promove.
  it('marca o eco da própria conta como saída', async () => {
    await postar(eventoDeMensagemPropria())

    expect(funil.registrar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ direcao: 'saida' }),
    )
  })
```

Use os construtores de evento que o arquivo já tem; se os nomes forem outros, adapte sem mudar o que os testes existentes afirmam.

- [ ] **Step 6: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/mensagens/__tests__/actions.test.ts' 'app/api/webhooks/evolution/[segredo]/__tests__/route.test.ts'`
Expected: PASS — os dois arquivos inteiros, com os testes novos.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/mensagens/actions.ts" "app/(app)/mensagens/__tests__/actions.test.ts" "app/api/webhooks/evolution/[segredo]/route.ts" "app/api/webhooks/evolution/[segredo]/__tests__/route.test.ts"
git commit -m "feat(funil): webhook e envio inscrevem a conversa"
```

---

### Task 4: Leitura da esteira por conversa

**Files:**
- Modify: `lib/consultas/esteira.ts` (reescrever)
- Modify: `app/(app)/esteira/page.tsx`
- Test: `lib/__tests__/consultas-esteira.test.ts`
- Read first: `lib/consultas/mensagens.ts` (a mesma reconciliação em memória, mesmo tom de comentário)

**Interfaces:**
- Consumes: `chaveDoNumero` de `@/lib/numeros`.
- Produces: `type Etapa = { id: string; nome: string; ordem: number; papel: Papel | null }`, `type LinhaDoFunil = { id: string; nome: string; numero: string; etapaId: string | null }`, `listarEsteira(): Promise<{ etapas: Etapa[]; linhas: LinhaDoFunil[] }>`.

O tipo `ContatoNaEsteira` deixa de existir. `LinhaDoFunil.id` é o id da linha do **funil**, não do contato — é ele que `moverNoFunil` recebe.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/__tests__/consultas-esteira.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarEsteira } from '@/lib/consultas/esteira'

const estado = vi.hoisted(() => ({
  etapas: [] as Record<string, unknown>[],
  funil: [] as Record<string, unknown>[],
  contatos: [] as Record<string, unknown>[],
  mensagens: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase/server', () => ({
  criarClienteServidor: async () => ({
    from: (tabela: string) => {
      const dados =
        tabela === 'etapas'
          ? estado.etapas
          : tabela === 'funil'
            ? estado.funil
            : tabela === 'contatos'
              ? estado.contatos
              : estado.mensagens
      const encadeado = {
        select: () => encadeado,
        order: () => encadeado,
        limit: () => encadeado,
        then: (r: (v: { data: unknown; error: null }) => void) => r({ data: dados, error: null }),
      }
      return encadeado
    },
  }),
}))

beforeEach(() => {
  estado.etapas = [{ id: 'e1', nome: 'Novo', ordem: 0, papel: 'entrada' }]
  estado.funil = [
    { id: 'f1', chave_numero: '556584038479', numero: '556584038479', etapa_id: 'e1' },
  ]
  estado.contatos = []
  estado.mensagens = []
})

describe('listarEsteira', () => {
  it('devolve o papel junto da etapa', async () => {
    const { etapas } = await listarEsteira()
    expect(etapas[0]).toEqual({ id: 'e1', nome: 'Novo', ordem: 0, papel: 'entrada' })
  })

  // O contato foi cadastrado com o nono dígito e a conversa veio sem: é a
  // mesma pessoa, e o card tem de mostrar o nome, não o número.
  it('acha o nome do contato pela chave canônica', async () => {
    estado.contatos = [{ nome: 'Matheus', numero: '5565984038479' }]

    const { linhas } = await listarEsteira()
    expect(linhas[0]).toMatchObject({ id: 'f1', nome: 'Matheus', numero: '556584038479' })
  })

  // Quem te escreveu sem estar no cadastro ainda tem nome: o pushName.
  it('cai no pushName quando não há contato', async () => {
    estado.mensagens = [{ numero: '556584038479', nome: 'Ana' }]

    const { linhas } = await listarEsteira()
    expect(linhas[0].nome).toBe('Ana')
  })

  it('cai no próprio número quando não há nome nenhum', async () => {
    const { linhas } = await listarEsteira()
    expect(linhas[0].nome).toBe('556584038479')
  })

  it('o contato cadastrado ganha do pushName', async () => {
    estado.contatos = [{ nome: 'Matheus', numero: '556584038479' }]
    estado.mensagens = [{ numero: '556584038479', nome: 'Ana' }]

    const { linhas } = await listarEsteira()
    expect(linhas[0].nome).toBe('Matheus')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/__tests__/consultas-esteira.test.ts`
Expected: FAIL — `listarEsteira` ainda devolve `contatos`.

- [ ] **Step 3: Reescrever a consulta**

```ts
// lib/consultas/esteira.ts
import type { Papel } from '@/lib/funil'
import { chaveDoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type Etapa = { id: string; nome: string; ordem: number; papel: Papel | null }

export type LinhaDoFunil = {
  /** Id da linha do funil — é este que `moverNoFunil` recebe. */
  id: string
  nome: string
  numero: string
  etapaId: string | null
}

/** Teto da varredura de nomes; o mesmo espírito de `listarConversas`. */
const LIMITE_NOMES = 500

/**
 * O funil inteiro, com o nome de exibição resolvido.
 *
 * O nome sai, nesta ordem, do contato cadastrado, do pushName da última
 * mensagem, ou do próprio número. A reconciliação é em memória e pela chave
 * canônica porque as três tabelas gravam o número em formas diferentes —
 * casar por igualdade crua mostraria o número no lugar do nome justamente
 * nas conversas que vieram de disparo.
 */
export async function listarEsteira(): Promise<{
  etapas: Etapa[]
  linhas: LinhaDoFunil[]
}> {
  const supabase = await criarClienteServidor()

  const [etapas, funil, contatos, mensagens] = await Promise.all([
    supabase.from('etapas').select('id, nome, ordem, papel').order('ordem'),
    supabase.from('funil').select('id, chave_numero, numero, etapa_id'),
    supabase.from('contatos').select('nome, numero'),
    supabase
      .from('mensagens')
      .select('numero, nome')
      .order('criado_em', { ascending: false })
      .limit(LIMITE_NOMES),
  ])

  const porContato = new Map<string, string>()
  for (const c of contatos.data ?? []) {
    if (c.nome) porContato.set(chaveDoNumero(String(c.numero)), String(c.nome))
  }

  // A lista vem da mais nova para a mais antiga; o primeiro nome que
  // aparecer é o mais recente, então não sobrescrever.
  const porPushName = new Map<string, string>()
  for (const m of mensagens.data ?? []) {
    const chave = chaveDoNumero(String(m.numero))
    if (m.nome && !porPushName.has(chave)) porPushName.set(chave, String(m.nome))
  }

  return {
    etapas: (etapas.data ?? []).map((e) => ({
      id: String(e.id),
      nome: String(e.nome),
      ordem: Number(e.ordem),
      papel: e.papel ? (String(e.papel) as Papel) : null,
    })),
    linhas: (funil.data ?? []).map((f) => {
      const chave = String(f.chave_numero)
      const numero = String(f.numero)
      return {
        id: String(f.id),
        nome: porContato.get(chave) ?? porPushName.get(chave) ?? numero,
        numero,
        etapaId: f.etapa_id ? String(f.etapa_id) : null,
      }
    }),
  }
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/__tests__/consultas-esteira.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Ajustar a página**

```tsx
// app/(app)/esteira/page.tsx
import { listarEsteira } from '@/lib/consultas/esteira'
import { Quadro } from './quadro'

export default async function Page() {
  const { etapas, linhas } = await listarEsteira()
  return <Quadro etapas={etapas} linhas={linhas} />
}
```

> `quadro.tsx` ainda espera `contatos` neste ponto — a Task 6 acerta. O typecheck fica vermelho entre as duas tasks, e isso é esperado: a verificação de tipo acontece uma vez, no fim.

- [ ] **Step 6: Commit**

```bash
git add lib/consultas/esteira.ts lib/__tests__/consultas-esteira.test.ts "app/(app)/esteira/page.tsx"
git commit -m "feat(esteira): leitura por conversa, com nome resolvido"
```

---

### Task 5: Ações do funil

**Files:**
- Modify: `app/(app)/esteira/actions.ts`
- Modify: `app/(app)/esteira/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `LIMITE_ETAPAS`, `nomeDeEtapaValido`, `proximaOrdem` de `@/lib/esteira`; `PAPEIS`, `Papel` de `@/lib/funil`.
- Produces: `type EstadoEsteira = { erro?: string; ok?: boolean; id?: string }`, `moverNoFunil(funilId: string, etapaId: string): Promise<EstadoEsteira>`, `definirPapel(etapaId: string, papel: Papel | null): Promise<EstadoEsteira>`; `criarEtapa(nome)` mantém a assinatura mas passa a devolver o `id` da etapa criada; `removerEtapa` não muda.

`criarEtapa` devolve o `id` porque a Task 6 precisa marcar o papel da etapa **logo depois de criá-la**, ao montar o funil padrão, e sem o id ela teria de reler a lista inteira para descobrir qual acabou de nascer.

`moverNoFunil` **não** aceita `null`: sem a coluna "Sem etapa", tirar da esteira deixou de ser uma operação.

- [ ] **Step 1: Escrever o teste falhando**

Substitua o `describe('moverContato')` do arquivo por:

```ts
describe('moverNoFunil', () => {
  it('atualiza a etapa e registra o histórico como manual', async () => {
    const r = await moverNoFunil('f1', 'e2')

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({ tabela: 'funil', etapa_id: 'e2' })
    // O histórico guarda o nome: renomear a etapa depois não reescreve o
    // passado. `automatico: false` separa isto da promoção do webhook.
    expect(estado.inserts.at(-1)).toMatchObject({
      tabela: 'funil_historico',
      funil_id: 'f1',
      de: 'Novo',
      automatico: false,
    })
  })

  it('recusa linha que não é do usuário', async () => {
    estado.linhaFunil = null
    const r = await moverNoFunil('alheia', 'e2')

    expect(r.erro).toBeTruthy()
    expect(estado.updates).toHaveLength(0)
  })

  it('recusa etapa de destino que não é do usuário', async () => {
    estado.etapaDestino = null
    const r = await moverNoFunil('f1', 'e-alheia')

    expect(r.erro).toMatch(/Etapa não encontrada/)
    expect(estado.updates).toHaveLength(0)
    expect(estado.inserts).toHaveLength(0)
  })

  it('recusa sem sessão', async () => {
    estado.usuario = null
    const r = await moverNoFunil('f1', 'e2')
    expect(r.erro).toMatch(/Sessão expirada/)
  })
})

describe('definirPapel', () => {
  it('marca o papel na etapa do usuário', async () => {
    const r = await definirPapel('e1', 'entrada')

    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({
      tabela: 'etapas',
      papel: 'entrada',
      id: 'e1',
      owner_id: 'user-1',
    })
  })

  it('aceita limpar o papel', async () => {
    const r = await definirPapel('e1', null)
    expect(r).toEqual({ ok: true })
    expect(estado.updates.at(-1)).toMatchObject({ papel: null })
  })

  it('recusa papel inventado', async () => {
    const r = await definirPapel('e1', 'chefe' as never)
    expect(r.erro).toBeTruthy()
    expect(estado.updates).toHaveLength(0)
  })

  // Índice único parcial: o papel já está em outra etapa.
  it('explica quando o papel já é de outra etapa', async () => {
    estado.erroUpdate = { code: '23505', message: 'duplicado' }
    const r = await definirPapel('e1', 'entrada')
    expect(r.erro).toMatch(/outra etapa/i)
  })
})
```

Ajuste o mock do arquivo para ter `estado.linhaFunil`, `estado.etapaDestino` e `estado.erroUpdate`, seguindo o padrão table-aware que ele já usa: `maybeSingle()` devolve `estado.linhaFunil` quando a tabela é `funil`, `estado.etapaDestino` quando é `etapas`. O `update` já registra as colunas — mantenha, e faça ele devolver `{ error: estado.erroUpdate }`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/esteira/__tests__/actions.test.ts'`
Expected: FAIL — `moverNoFunil` e `definirPapel` não existem.

- [ ] **Step 3: Reescrever as ações**

Troque `moverContato` inteiro por:

```ts
/**
 * Move a conversa de etapa e registra a passagem.
 *
 * `null` não é destino válido: sem a coluna "Sem etapa", tirar do funil
 * deixou de ser uma operação da tela.
 */
export async function moverNoFunil(
  funilId: string,
  etapaId: string,
): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: linha } = await supabase
    .from('funil')
    .select('id, etapa_id, etapas(nome)')
    .eq('id', funilId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!linha) return { erro: 'Conversa não encontrada.' }

  const { data: destino } = await supabase
    .from('etapas')
    .select('nome')
    .eq('id', etapaId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!destino) return { erro: 'Etapa não encontrada.' }

  const { error } = await supabase
    .from('funil')
    .update({ etapa_id: etapaId, atualizado_em: new Date().toISOString() })
    .eq('id', funilId)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível mover a conversa.' }

  // Falha aqui não desfaz a movimentação: a conversa já está na etapa
  // certa, e perder uma linha de histórico é menos grave que devolver erro
  // para uma ação que aconteceu.
  const { error: erroHistorico } = await supabase.from('funil_historico').insert({
    owner_id: user.id,
    funil_id: funilId,
    de: (linha as { etapas?: { nome?: string } }).etapas?.nome ?? null,
    para: String(destino.nome),
    automatico: false,
  })

  if (erroHistorico) {
    console.error('[esteira] histórico não gravou:', erroHistorico.code, erroHistorico.message)
  }

  revalidatePath('/esteira')
  return { ok: true }
}

/**
 * Marca qual etapa recebe conversa nova e qual recebe quem respondeu.
 *
 * É o que permite renomear as etapas sem quebrar a automação: ela procura
 * o papel, nunca o nome.
 */
export async function definirPapel(
  etapaId: string,
  papel: Papel | null,
): Promise<EstadoEsteira> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  if (papel !== null && !PAPEIS.includes(papel)) {
    return { erro: 'Papel inválido.' }
  }

  const { error } = await supabase
    .from('etapas')
    .update({ papel })
    .eq('id', etapaId)
    .eq('owner_id', user.id)

  if (error) {
    if (error.code === '23505') {
      return { erro: 'Esse papel já pertence a outra etapa. Tire dela primeiro.' }
    }
    return { erro: 'Não foi possível definir o papel da etapa.' }
  }

  revalidatePath('/esteira')
  return { ok: true }
}
```

Acrescente ao topo: `import { PAPEIS, type Papel } from '@/lib/funil'`.

Em `removerEtapa`, troque o comentário que fala em contatos por: `// O 'on delete set null' da 0015 deixa a linha do funil órfã; a próxima mensagem daquela conversa devolve ela para a entrada.`

Em `criarEtapa`, estenda o tipo e devolva o id da etapa criada:

```ts
export type EstadoEsteira = { erro?: string; ok?: boolean; id?: string }
```

```ts
  const { data: criada, error } = await supabase
    .from('etapas')
    .insert({
      owner_id: user.id,
      nome: limpo,
      ordem: proximaOrdem(ordens),
    })
    // O id volta porque montar o funil padrão precisa marcar o papel logo
    // em seguida; sem ele, a tela teria de reler tudo para achar qual etapa
    // acabou de nascer.
    .select('id')
    .maybeSingle()
```

O tratamento de `error` continua idêntico. O retorno de sucesso vira `{ ok: true, id: criada ? String(criada.id) : undefined }`.

Acrescente o teste:

```ts
  it('devolve o id da etapa criada', async () => {
    const r = await criarEtapa('Negociando')
    expect(r.id).toBe('e-nova')
  })
```

Faça o mock do `insert` devolver `{ data: { id: 'e-nova' }, error: estado.erroInsert }` quando encadeado com `.select().maybeSingle()`, mantendo o registro em `estado.inserts` que os testes existentes já usam.

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/esteira/__tests__/actions.test.ts'`
Expected: PASS — o arquivo inteiro, com os 8 testes novos.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/esteira/actions.ts" "app/(app)/esteira/__tests__/actions.test.ts"
git commit -m "feat(esteira): mover conversa no funil e marcar papel da etapa"
```

---

### Task 6: Quadro com arrastar, busca e rolagem

**Files:**
- Modify: `package.json` (dependências)
- Create: `app/(app)/esteira/arraste.ts`
- Modify: `app/(app)/esteira/quadro.tsx` (reescrever)
- Test: `app/(app)/esteira/__tests__/arraste.test.ts`
- Modify: `app/(app)/esteira/__tests__/quadro.test.tsx`

**Interfaces:**
- Consumes: `Etapa`, `LinhaDoFunil` de `@/lib/consultas/esteira`; `moverNoFunil`, `criarEtapa`, `removerEtapa`, `definirPapel` de `../actions`; `ETAPAS_PADRAO`, `LIMITE_NOME_ETAPA` de `@/lib/esteira`; `PAPEIS`, `type Papel` de `@/lib/funil`; `chaveDoNumero` de `@/lib/numeros`.
- Produces: `resolverArraste(evento): { funilId: string; etapaId: string } | null`; componente `Quadro({ etapas, linhas })`.

Arrastar em jsdom não é testável de forma honesta. Por isso a decisão do arraste sai do componente e vira `resolverArraste`, testada pura; o componente é testado pelo que dá para ver — colunas, contadores, busca, estado vazio.

- [ ] **Step 1: Instalar as dependências**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

`@dnd-kit/utilities` entra explicitamente porque o componente importa `CSS` dele. Ele é dependência interna de `sortable`, e depender disso por acaso quebra na primeira vez que a árvore for reinstalada achatada de outro jeito.

- [ ] **Step 2: Escrever o teste do arraste**

```ts
// app/(app)/esteira/__tests__/arraste.test.ts
import { describe, expect, it } from 'vitest'
import { resolverArraste } from '@/app/(app)/esteira/arraste'

describe('resolverArraste', () => {
  it('lê a conversa arrastada e a coluna de destino', () => {
    expect(
      resolverArraste({ active: { id: 'f1' }, over: { id: 'e2' } }),
    ).toEqual({ funilId: 'f1', etapaId: 'e2' })
  })

  // Soltar fora de qualquer coluna é desistir do arraste, não um erro.
  it('devolve nulo quando solta fora de uma coluna', () => {
    expect(resolverArraste({ active: { id: 'f1' }, over: null })).toBeNull()
  })

  // Soltar na mesma coluna não é movimento: evita ida ao servidor à toa.
  it('devolve nulo quando a origem já é o destino', () => {
    expect(
      resolverArraste({ active: { id: 'f1', data: { etapaId: 'e2' } }, over: { id: 'e2' } }),
    ).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/esteira/__tests__/arraste.test.ts'`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar o resolvedor**

```ts
// app/(app)/esteira/arraste.ts

/** O recorte do evento do dnd-kit que a decisão precisa. */
export type EventoDeArraste = {
  active: { id: string | number; data?: { etapaId?: string | null } }
  over: { id: string | number } | null
}

/**
 * O que fazer quando o card é solto.
 *
 * Fica fora do componente porque arrastar não é testável de forma honesta
 * em jsdom: aqui a regra é verificável, e o componente só a obedece.
 */
export function resolverArraste(
  evento: EventoDeArraste,
): { funilId: string; etapaId: string } | null {
  if (!evento.over) return null

  const etapaId = String(evento.over.id)
  if (evento.active.data?.etapaId === etapaId) return null

  return { funilId: String(evento.active.id), etapaId }
}
```

- [ ] **Step 5: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/esteira/__tests__/arraste.test.ts'`
Expected: PASS (3 testes)

- [ ] **Step 6: Escrever os testes do quadro**

Reescreva `app/(app)/esteira/__tests__/quadro.test.tsx` mantendo o que já existe sobre criar etapa, funil padrão, remover em dois cliques e estado vazio, trocando as fixtures de `contatos` por `linhas` e removendo tudo que testava o `<select>` e a coluna "Sem etapa". Acrescente:

```tsx
const linhas = [
  { id: 'f1', nome: 'Matheus', numero: '556584038479', etapaId: 'e1' },
  { id: 'f2', nome: 'Ana', numero: '5511999998888', etapaId: 'e2' },
]

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
})
```

E no bloco de mocks do arquivo, acrescente `definirPapel: (id: string, p: string | null) => acoes.definirPapel(id, p)` e `moverNoFunil: (f: string, e: string) => acoes.mover(f, e)` no lugar de `moverContato`.

- [ ] **Step 7: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/esteira/__tests__/quadro.test.tsx'`
Expected: FAIL — `Quadro` ainda recebe `contatos`.

- [ ] **Step 8: Reescrever o quadro**

Mudanças, sobre o arquivo que já existe:

1. **Props:** `{ etapas, linhas }` em vez de `{ etapas, contatos }`.
2. **Fora a coluna "Sem etapa"**: `colunas` passa a ser só `etapas`. Some com `SEM_ETAPA` e com `etapaVisivel`; linha órfã não aparece até a próxima mensagem devolvê-la à entrada — comente isso.
3. **Fora o `<select>` do card.**
4. **Busca**, acima do quadro:

```tsx
  const [busca, setBusca] = useState('')

  // Busca por número compara pela chave canônica: o contato pode ter sido
  // salvo com o nono dígito e a conversa ter vindo sem, e digitar qualquer
  // uma das formas tem de achar a mesma pessoa.
  const termo = busca.trim().toLowerCase()
  const termoCanonico = chaveDoNumero(termo)
  const visiveis = linhas.filter(
    (l) =>
      !termo ||
      l.nome.toLowerCase().includes(termo) ||
      (termoCanonico !== '' && chaveDoNumero(l.numero).includes(termoCanonico)),
  )
```

O campo é `<Input type="search" aria-label="Buscar conversa" .../>`.

5. **Coluna com altura fixa e rolagem própria:** a lista de cards de cada `<section>` ganha `className="flex flex-1 flex-col gap-2 overflow-y-auto"` e a `<section>` ganha `max-h-[70vh]`. O contador passa a mostrar `daColuna.length` já filtrado.

6. **Arrastar:** envolva o quadro em `DndContext` e faça de cada coluna um alvo e de cada card um item:

```tsx
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Sensores — os três, porque acessibilidade foi o motivo de o plano anterior ter recusado arrastar:

```tsx
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
```

O `DndContext` usa `collisionDetection={closestCorners}` e:

```tsx
  async function aoSoltar(evento: DragEndEvent) {
    const destino = resolverArraste(evento as never)
    if (!destino) return
    await mover(destino.funilId, destino.etapaId)
  }
```

Cada `<section>` de coluna vira um `SortableContext` com `items={daColuna.map((l) => l.id)}`; o `id` do droppable é o id da etapa. Cada card usa `useSortable({ id: l.id, data: { etapaId: l.etapaId } })` e aplica `ref`, `style` com `CSS.Transform.toString(transform)`, e `{...attributes} {...listeners}` num botão de alça com `aria-label={\`Mover ${l.nome}\`}`.

7. **Papel na coluna:** ao lado do botão de remover, um botão por papel disponível:

```tsx
                {PAPEIS.map((papel) => (
                  <button
                    key={papel}
                    type="button"
                    onClick={() => marcarPapel(coluna.id, papel)}
                    aria-label={`Usar ${coluna.nome} como ${papel}`}
                    aria-pressed={coluna.papel === papel}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {papel === 'entrada' ? 'entrada' : 'respondeu'}
                  </button>
                ))}
```

E a função:

```tsx
  async function marcarPapel(etapaId: string, papel: Papel) {
    setErro('')
    const alvo = etapas.find((e) => e.id === etapaId)
    // Clicar no papel que a etapa já tem tira o papel dela: é o único jeito
    // de desligar a automação sem apagar a coluna.
    const resultado = await definirPapel(etapaId, alvo?.papel === papel ? null : papel)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    router.refresh()
  }
```

8. **`criarFunilPadrao`** passa a marcar os papéis das duas primeiras etapas, usando o `id` que `criarEtapa` devolve desde a Task 5:

```tsx
      for (const [indice, nome] of ETAPAS_PADRAO.entries()) {
        const resultado = await criarEtapa(nome)
        if (resultado.erro) {
          setErro(resultado.erro)
          router.refresh()
          return
        }
        // As duas primeiras etapas do funil padrão carregam a automação;
        // sem isto o funil nasceria bonito e inerte.
        const papel = indice === 0 ? 'entrada' : indice === 1 ? 'respondeu' : null
        if (papel && resultado.id) await definirPapel(resultado.id, papel)
      }
```

Acrescente ao teste de funil padrão a asserção de que `definirPapel` foi chamado com `'entrada'` e depois com `'respondeu'`.

- [ ] **Step 9: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/esteira/__tests__/quadro.test.tsx'`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json "app/(app)/esteira/"
git commit -m "feat(esteira): arrastar entre colunas, busca e papel da etapa"
```

---

## Verificação final

A única verificação ampla do plano, por instrução do usuário.

- [ ] `npx tsc --noEmit` — limpo
- [ ] `npm run test:run` — suíte verde
- [ ] `npm run build` — completo; restaurar `next-env.d.ts` com `git checkout -- next-env.d.ts`
- [ ] `git status` limpo

Depois, com a 0015 aplicada pelo usuário no SQL Editor:

- [ ] Criar o funil padrão pela tela e conferir que "Novo" aparece como entrada e "Em conversa" como respondeu
- [ ] Mandar mensagem de um número que **não** está em Contatos → nasce card em "Novo", com o pushName
- [ ] Esse contato responder → o card vai sozinho para "Em conversa"
- [ ] Arrastar o card para "Negociando" com o mouse; repetir com o teclado (Tab até a alça, espaço, setas, espaço)
- [ ] O contato mandar outra mensagem → o card **continua** em "Negociando"
- [ ] Buscar pelo número na outra forma do nono dígito → o card aparece
- [ ] Renomear não existe; apagar a etapa de entrada e conferir que conversa nova simplesmente não entra, sem erro

## O que este plano deliberadamente NÃO faz

- **Não classifica por interesse ou engajamento.** Continua sendo `2026-08-21-inteligencia-clientes.md`.
- **Não reordena etapas.** Arrastar move card entre colunas, não colunas entre si.
- **Não filtra por etiqueta.**
- **Não mexe em `contatos`** — nem coluna, nem índice, nem dado.
- **Não tira ninguém do funil.** Não há saída automática nem botão de arquivar.
