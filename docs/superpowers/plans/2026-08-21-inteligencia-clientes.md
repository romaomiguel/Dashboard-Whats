# Inteligência de Clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classificar contatos por engajamento a partir do histórico real de interação, e responder "Quem devo contatar hoje?" com uma lista ordenada e explicável.

**Architecture:** O sinal já existe espalhado — `mensagens.direcao`, `mensagens.status` (que o webhook atualiza para `entregue` e `lida` pelos recibos) e `disparo_envios`. O que falta é durabilidade e agregação. Este plano cria `public.interacoes`, uma tabela **append-only sem FK para `instances`**, alimentada no mesmo ponto onde a mensagem é gravada. A classificação e a pontuação ficam em módulo puro, sem banco, para serem testáveis e — mais importante — explicáveis na tela.

**Tech Stack:** Next.js 16.3, TypeScript, Supabase (Postgres + RLS), Vitest.

**Spec:** `implementation.txt`, item 3 — "analisar histórico, respostas, leituras, cliques e frequência de interação para identificar clientes propensos, inativos, engajados, em risco e com interesse crescente, incluindo a função 'Quem devo contatar hoje?'".

## Os dois bloqueios, e o que este plano faz com eles

**1. O histórico de conversa é apagado quando a conexão é removida.** A migration 0011 pôs `on delete cascade` em `mensagens.instance_id`, e essa decisão foi mantida conscientemente. Aconteceu duas vezes em 20–21/08 com dados reais. Como a matéria-prima desta feature é exatamente esse histórico, a feature seria natimorta.

**A saída, e é o coração deste plano:** `public.interacoes` **não tem FK para `instances`**. Ela guarda o fato ("este número respondeu em tal instante"), não a mensagem. Remover a conexão continua apagando as conversas — decisão preservada — e a inteligência sobrevive intacta. O custo é duplicar um pouco de informação; o benefício é que a análise deixa de depender de um dado volátil.

**2. Cliques não existem em lugar nenhum do código.** Rastreá-los exige rota de redirecionamento, tabela e reescrita dos links nas mensagens enviadas. Link reescrito no WhatsApp parece encurtador de spam: piora entrega e aumenta risco de bloqueio — o oposto do plano de ritmo. Por isso o rastreio é a **Task 7, marcada como opcional**, isolada do resto: as Tasks 1–6 entregam a feature inteira sem ela, e `interacoes` já nasce com o tipo `clique` previsto, para ligá-lo depois sem migration nova.

**3. Não há dados hoje.** Uma conexão, poucas mensagens. As regras de classificação abaixo são calibráveis por constante no topo do módulo, de propósito: elas vão precisar de ajuste quando houver histórico real, e isso não pode exigir reescrever lógica.

## Global Constraints

- **Comentários em português**, explicando *por que*. Nunca comentar o óbvio.
- **TDD**: teste falhando antes da implementação; suíte verde a cada task.
- **`npx tsc --noEmit` limpo** ao fim de cada task.
- **Nada de IA nem de caixa-preta.** A classificação é regra explícita sobre contagens. O usuário precisa poder discordar da sugestão sabendo por que ela apareceu — e é isso que faz a lista ser usada em vez de ignorada.
- **Toda função de análise recebe `agora: Date` por parâmetro**, nunca chama `Date.now()` por dentro. Sem isso não há como testar janela temporal.
- **Agrupamento sempre por `chaveDoNumero`** (`lib/numeros.ts`): o disparo grava com o nono dígito e o webhook sem ele.
- **Numeração de migration:** ocupa **0017**, assumindo 0014/0015 (chat e esteira) e 0016 (ritmo). Conferir `ls supabase/migrations/` e ajustar.
- Commits frequentes, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: A tabela que sobrevive ao cascade

**Files:**
- Create: `supabase/migrations/0017_interacoes.sql`

**Interfaces:**
- Produces: tabela `public.interacoes (id, owner_id, numero_chave, tipo, quando)`.

- [ ] **Step 1: Conferir o número livre**

Run: `ls supabase/migrations/ | tail -3`

- [ ] **Step 2: Escrever a migration**

```sql
-- supabase/migrations/0017_interacoes.sql

create type public.interacao_tipo as enum (
  'enviada', 'recebida', 'entregue', 'lida', 'clique'
);

-- Histórico de interação, à prova do cascade.
--
-- A 0011 pôs `on delete cascade` em mensagens.instance_id: remover a conexão
-- apaga as conversas dela. Essa decisão foi mantida de propósito, mas a
-- análise de cliente não pode morrer junto — o valor acumulado do CRM está
-- justamente aqui.
--
-- Por isso esta tabela NÃO referencia instances. Ela guarda o fato ("este
-- número respondeu em tal instante"), não a mensagem. Some a conversa, fica a
-- inteligência.
--
-- numero_chave é a forma canônica de lib/numeros.ts (sem o nono dígito), e
-- não FK para contatos: quem escreve pode não estar cadastrado, e apagar o
-- cadastro não pode apagar o passado.
create table public.interacoes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  numero_chave  text not null,
  tipo          public.interacao_tipo not null,
  quando        timestamptz not null default now(),
  constraint numero_chave_valida check (length(trim(numero_chave)) between 1 and 32)
);

-- Serve as duas consultas: o perfil de um contato e a varredura do dono
-- inteiro por faixa de data.
create index interacoes_dono_idx
  on public.interacoes (owner_id, numero_chave, quando desc);

create index interacoes_periodo_idx
  on public.interacoes (owner_id, quando desc);

alter table public.interacoes enable row level security;

create policy propria_interacao on public.interacoes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
```

- [ ] **Step 3: Aplicar e conferir**

```bash
set -a; . ./.env; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/interacoes?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `[]`, não erro de tabela inexistente.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0017_interacoes.sql
git commit -m "feat(inteligencia): histórico de interação que sobrevive ao cascade"
```

---

### Task 2: Registrar a interação

**Files:**
- Create: `lib/inteligencia/registrar.ts`
- Test: `lib/inteligencia/__tests__/registrar.test.ts`
- Modify: `app/api/webhooks/evolution/[segredo]/route.ts` (nos três pontos de gravação)
- Modify: `lib/disparos/processador.ts` (no envio)
- Modify: `app/(app)/mensagens/actions.ts` (envio avulso, se o plano de chat já estiver aplicado)

**Interfaces:**
- Consumes: `chaveDoNumero` de `@/lib/numeros`.
- Produces: `registrarInteracao(db: SupabaseClient, ownerId: string, numero: string, tipo: TipoInteracao): Promise<void>`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/inteligencia/__tests__/registrar.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarInteracao } from '@/lib/inteligencia/registrar'

const estado = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  erro: null as { code: string; message: string } | null,
}))

function db() {
  return {
    from: () => ({
      insert: async (valores: Record<string, unknown>) => {
        estado.inserts.push(valores)
        return { error: estado.erro }
      },
    }),
  } as never
}

beforeEach(() => {
  estado.inserts = []
  estado.erro = null
})

describe('registrarInteracao', () => {
  // Guarda a forma canônica: o disparo grava com o nono dígito e o webhook
  // sem ele, e sem normalizar a mesma pessoa viraria dois perfis.
  it('normaliza o número antes de gravar', async () => {
    await registrarInteracao(db(), 'user-1', '5565984038479', 'recebida')

    expect(estado.inserts.at(-1)).toMatchObject({
      owner_id: 'user-1',
      numero_chave: '556584038479',
      tipo: 'recebida',
    })
  })

  it('aceita as duas formas e produz a mesma chave', async () => {
    await registrarInteracao(db(), 'user-1', '556584038479', 'lida')
    expect(estado.inserts.at(-1)).toMatchObject({ numero_chave: '556584038479' })
  })

  // Falha aqui não pode derrubar quem chama: no webhook isso faria a Evolution
  // reenviar o evento em laço, e no disparo pararia o lote no meio.
  it('engole erro de banco em vez de lançar', async () => {
    estado.erro = { code: '42P01', message: 'relation does not exist' }

    await expect(
      registrarInteracao(db(), 'user-1', '556584038479', 'recebida'),
    ).resolves.toBeUndefined()
  })

  it('não grava com número vazio', async () => {
    await registrarInteracao(db(), 'user-1', '', 'recebida')
    expect(estado.inserts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/inteligencia/__tests__/registrar.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/inteligencia/registrar.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { chaveDoNumero } from '@/lib/numeros'

export type TipoInteracao = 'enviada' | 'recebida' | 'entregue' | 'lida' | 'clique'

/**
 * Anota que algo aconteceu com este número.
 *
 * Append-only e sem vínculo com a conexão: é o que permite a análise
 * sobreviver à remoção de uma conexão, que apaga as conversas por cascade.
 *
 * Nunca lança. No webhook, uma exceção faria a Evolution reenviar o evento em
 * laço; no disparo, pararia o lote no meio. Perder uma linha de análise é
 * incomparavelmente menos grave.
 */
export async function registrarInteracao(
  db: SupabaseClient,
  ownerId: string,
  numero: string,
  tipo: TipoInteracao,
): Promise<void> {
  const chave = chaveDoNumero(numero)
  if (!chave) return

  try {
    const { error } = await db.from('interacoes').insert({
      owner_id: ownerId,
      numero_chave: chave,
      tipo,
    })

    if (error) {
      console.error('[interacao] não gravou:', error.code, error.message)
    }
  } catch (erro) {
    console.error('[interacao] rejeitou:', erro)
  }
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/inteligencia/__tests__/registrar.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Ligar aos pontos de gravação**

Chamar `registrarInteracao` (sempre depois da gravação principal, nunca antes — ela não pode atrasar o que importa):

| Onde | Quando | Tipo |
|---|---|---|
| `route.ts`, em `registrarRecebida` | mensagem de contato (`!daPropriaConta`) | `recebida` |
| `route.ts`, em `registrarRecebida` | mensagem própria (`daPropriaConta`) | `enviada` |
| `route.ts`, em `registrarRecibo` | recibo aplicado | `entregue` ou `lida` |
| `processador.ts` | envio bem-sucedido do disparo | `enviada` |
| `mensagens/actions.ts` | envio avulso bem-sucedido | `enviada` |

Em `registrarRecibo` o número não está no payload do recibo: pegar de `mensagens` na mesma consulta que já busca a linha por `mensagem_key` (acrescentar `numero, owner_id` ao `select`).

- [ ] **Step 6: Typecheck e suíte**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 7: Verificar de ponta a ponta**

Com o app publicado, mandar uma mensagem de outro celular para o número conectado e conferir:

```bash
set -a; . ./.env; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/interacoes?select=numero_chave,tipo,quando&order=quando.desc&limit=5" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: linha `recebida` com o número canônico.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(inteligencia): registrar interação nos pontos de mensagem"
```

---

### Task 3: Classificação e pontuação

**Files:**
- Create: `lib/inteligencia.ts`
- Test: `lib/__tests__/inteligencia.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro).
- Produces:
```ts
export type Classe = 'novo' | 'engajado' | 'crescendo' | 'em_risco' | 'inativo'
export type LinhaInteracao = { tipo: string; quando: string }
export type PerfilContato = {
  recebidas: number; enviadas: number; lidas: number
  ultimaEntrada: string | null; ultimaSaida: string | null
  taxaResposta: number; diasSemResposta: number | null
}
export function resumirInteracoes(linhas: LinhaInteracao[], agora: Date): PerfilContato
export function classificar(p: PerfilContato, linhas: LinhaInteracao[], agora: Date): Classe
export function pontuarContato(p: PerfilContato, classe: Classe): number
export function motivoDaSugestao(classe: Classe, p: PerfilContato): string
export const ROTULO_CLASSE: Record<Classe, string>
```

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/__tests__/inteligencia.test.ts
import { describe, expect, it } from 'vitest'
import {
  classificar,
  motivoDaSugestao,
  pontuarContato,
  resumirInteracoes,
  type LinhaInteracao,
} from '@/lib/inteligencia'

const agora = new Date('2026-08-21T12:00:00.000Z')
const DIA = 24 * 60 * 60 * 1000

function atras(dias: number): string {
  return new Date(agora.getTime() - dias * DIA).toISOString()
}

function linhas(...pares: [string, number][]): LinhaInteracao[] {
  return pares.map(([tipo, dias]) => ({ tipo, quando: atras(dias) }))
}

describe('resumirInteracoes', () => {
  it('conta cada tipo', () => {
    const p = resumirInteracoes(
      linhas(['enviada', 5], ['recebida', 4], ['lida', 4], ['recebida', 1]),
      agora,
    )
    expect(p.enviadas).toBe(1)
    expect(p.recebidas).toBe(2)
    expect(p.lidas).toBe(1)
  })

  it('acha a última de cada direção', () => {
    const p = resumirInteracoes(linhas(['enviada', 9], ['recebida', 2]), agora)
    expect(p.ultimaEntrada).toBe(atras(2))
    expect(p.ultimaSaida).toBe(atras(9))
  })

  // Taxa de resposta é o sinal mais forte de interesse: quantas das minhas
  // mensagens tiveram resposta.
  it('calcula a taxa de resposta', () => {
    const p = resumirInteracoes(
      linhas(['enviada', 9], ['enviada', 8], ['recebida', 7]),
      agora,
    )
    expect(p.taxaResposta).toBeCloseTo(0.5)
  })

  // Divisão por zero: contato que nunca recebeu nada nosso.
  it('taxa é zero quando nada saiu', () => {
    expect(resumirInteracoes(linhas(['recebida', 1]), agora).taxaResposta).toBe(0)
  })

  it('conta os dias desde a última resposta', () => {
    expect(resumirInteracoes(linhas(['recebida', 10]), agora).diasSemResposta).toBe(10)
  })

  it('dias sem resposta é nulo para quem nunca respondeu', () => {
    expect(resumirInteracoes(linhas(['enviada', 3]), agora).diasSemResposta).toBeNull()
  })

  it('aguenta lista vazia', () => {
    const p = resumirInteracoes([], agora)
    expect(p.recebidas).toBe(0)
    expect(p.ultimaEntrada).toBeNull()
  })
})

describe('classificar', () => {
  it('quem nunca interagiu é novo', () => {
    const l = linhas(['enviada', 1])
    expect(classificar(resumirInteracoes(l, agora), l, agora)).toBe('novo')
  })

  it('quem respondeu esta semana é engajado', () => {
    const l = linhas(['enviada', 4], ['recebida', 3], ['recebida', 1])
    expect(classificar(resumirInteracoes(l, agora), l, agora)).toBe('engajado')
  })

  // Interesse crescente: respondeu mais nos últimos 7 dias do que nos 7
  // anteriores. É o sinal de quem está esquentando.
  it('quem responde mais que antes está crescendo', () => {
    const l = linhas(
      ['recebida', 13],
      ['recebida', 6],
      ['recebida', 4],
      ['recebida', 2],
    )
    expect(classificar(resumirInteracoes(l, agora), l, agora)).toBe('crescendo')
  })

  // Já respondeu, sumiu há mais de duas semanas mas menos de um mês: dá para
  // resgatar, e é justo quem a lista de hoje deve priorizar.
  it('quem respondia e sumiu está em risco', () => {
    const l = linhas(['enviada', 40], ['recebida', 20])
    expect(classificar(resumirInteracoes(l, agora), l, agora)).toBe('em_risco')
  })

  it('quem sumiu há mais de um mês é inativo', () => {
    const l = linhas(['enviada', 60], ['recebida', 45])
    expect(classificar(resumirInteracoes(l, agora), l, agora)).toBe('inativo')
  })
})

describe('pontuarContato', () => {
  // "Em risco" no topo: é onde a ação de hoje muda o resultado. Engajado já
  // está conversando e não precisa ser resgatado.
  it('põe em risco acima de engajado', () => {
    const p = resumirInteracoes(linhas(['recebida', 20]), agora)
    expect(pontuarContato(p, 'em_risco')).toBeGreaterThan(pontuarContato(p, 'engajado'))
  })

  it('põe crescendo acima de inativo', () => {
    const p = resumirInteracoes(linhas(['recebida', 3]), agora)
    expect(pontuarContato(p, 'crescendo')).toBeGreaterThan(pontuarContato(p, 'inativo'))
  })

  // Quem responde muito merece prioridade sobre quem nunca responde, dentro
  // da mesma classe.
  it('desempata pela taxa de resposta', () => {
    const alto = resumirInteracoes(linhas(['enviada', 9], ['recebida', 8]), agora)
    const baixo = resumirInteracoes(
      linhas(['enviada', 9], ['enviada', 8], ['enviada', 7], ['recebida', 6]),
      agora,
    )
    expect(pontuarContato(alto, 'em_risco')).toBeGreaterThan(
      pontuarContato(baixo, 'em_risco'),
    )
  })
})

describe('motivoDaSugestao', () => {
  // A lista só é usada se o usuário entender por que o nome apareceu.
  it('explica em uma frase, com número', () => {
    const p = resumirInteracoes(linhas(['recebida', 20]), agora)
    const motivo = motivoDaSugestao('em_risco', p)

    expect(motivo).toMatch(/20/)
    expect(motivo.length).toBeGreaterThan(10)
  })

  it('tem frase para toda classe', () => {
    const p = resumirInteracoes(linhas(['recebida', 1]), agora)
    for (const c of ['novo', 'engajado', 'crescendo', 'em_risco', 'inativo'] as const) {
      expect(motivoDaSugestao(c, p)).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/__tests__/inteligencia.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/inteligencia"`

- [ ] **Step 3: Implementar**

```ts
// lib/inteligencia.ts

/**
 * Classificação de contato por engajamento.
 *
 * Regra explícita, não modelo: o usuário precisa poder discordar da sugestão
 * sabendo por que ela apareceu. Lista que não se explica não é usada.
 *
 * As constantes abaixo são o painel de calibragem. Elas foram escolhidas sem
 * dados — quando houver histórico real, é aqui que se mexe, e em nenhum outro
 * lugar.
 */

/** Respondeu dentro disto: ainda está na conversa. */
const DIAS_ENGAJADO = 7
/** Sumiu além disto, mas já respondeu antes: dá para resgatar. */
const DIAS_RISCO = 14
/** Além disto, resgatar deixa de ser realista. */
const DIAS_INATIVO = 30
/** Janela usada para comparar "agora" com "antes" e detectar crescimento. */
const JANELA_TENDENCIA_DIAS = 7

const DIA_MS = 24 * 60 * 60 * 1000

export type Classe = 'novo' | 'engajado' | 'crescendo' | 'em_risco' | 'inativo'

export const ROTULO_CLASSE: Record<Classe, string> = {
  novo: 'Novo',
  engajado: 'Engajado',
  crescendo: 'Interesse crescente',
  em_risco: 'Em risco',
  inativo: 'Inativo',
}

export type LinhaInteracao = { tipo: string; quando: string }

export type PerfilContato = {
  recebidas: number
  enviadas: number
  lidas: number
  ultimaEntrada: string | null
  ultimaSaida: string | null
  taxaResposta: number
  diasSemResposta: number | null
}

function diasEntre(depois: Date, antes: string): number {
  return Math.floor((depois.getTime() - new Date(antes).getTime()) / DIA_MS)
}

export function resumirInteracoes(
  linhas: LinhaInteracao[],
  agora: Date,
): PerfilContato {
  let recebidas = 0
  let enviadas = 0
  let lidas = 0
  let ultimaEntrada: string | null = null
  let ultimaSaida: string | null = null

  for (const linha of linhas) {
    if (linha.tipo === 'recebida') {
      recebidas += 1
      if (!ultimaEntrada || linha.quando > ultimaEntrada) ultimaEntrada = linha.quando
    } else if (linha.tipo === 'enviada') {
      enviadas += 1
      if (!ultimaSaida || linha.quando > ultimaSaida) ultimaSaida = linha.quando
    } else if (linha.tipo === 'lida') {
      lidas += 1
    }
  }

  return {
    recebidas,
    enviadas,
    lidas,
    ultimaEntrada,
    ultimaSaida,
    // Sem nada enviado não há taxa: zero, e não divisão por zero.
    taxaResposta: enviadas === 0 ? 0 : Math.min(1, recebidas / enviadas),
    diasSemResposta: ultimaEntrada ? diasEntre(agora, ultimaEntrada) : null,
  }
}

/** Quantas respostas caíram na janela que termina `desloc` dias atrás. */
function recebidasNaJanela(
  linhas: LinhaInteracao[],
  agora: Date,
  desloc: number,
): number {
  const fim = agora.getTime() - desloc * DIA_MS
  const inicio = fim - JANELA_TENDENCIA_DIAS * DIA_MS

  return linhas.filter((l) => {
    if (l.tipo !== 'recebida') return false
    const t = new Date(l.quando).getTime()
    return t > inicio && t <= fim
  }).length
}

export function classificar(
  perfil: PerfilContato,
  linhas: LinhaInteracao[],
  agora: Date,
): Classe {
  // Nunca respondeu: não há engajamento para medir, só um contato frio.
  if (perfil.recebidas === 0) return 'novo'

  const dias = perfil.diasSemResposta ?? Number.POSITIVE_INFINITY

  if (dias >= DIAS_INATIVO) return 'inativo'
  if (dias >= DIAS_RISCO) return 'em_risco'

  // Crescimento tem prioridade sobre "engajado": os dois respondem na semana,
  // mas quem está subindo merece atenção diferente de quem só se mantém.
  const agora7 = recebidasNaJanela(linhas, agora, 0)
  const antes7 = recebidasNaJanela(linhas, agora, JANELA_TENDENCIA_DIAS)
  if (agora7 > antes7 && antes7 > 0) return 'crescendo'

  if (dias <= DIAS_ENGAJADO) return 'engajado'

  return 'em_risco'
}

/** Peso base por classe: onde a ação de hoje muda mais o resultado. */
const PESO: Record<Classe, number> = {
  // No topo: já demonstrou interesse e está escapando. É o resgate possível.
  em_risco: 100,
  // Esquentando agora; falar hoje aproveita o movimento.
  crescendo: 80,
  // Está conversando; não precisa ser resgatado.
  engajado: 40,
  // Nunca respondeu: vale tentar, mas depois de quem já respondeu.
  novo: 30,
  // Resgate pouco provável; fica por último sem sumir da lista.
  inativo: 10,
}

/**
 * Nota para ordenar "Quem devo contatar hoje?".
 *
 * A classe manda; a taxa de resposta desempata dentro dela, porque quem
 * costuma responder tem mais chance de responder de novo.
 */
export function pontuarContato(perfil: PerfilContato, classe: Classe): number {
  return PESO[classe] + perfil.taxaResposta * 10
}

/** Frase curta que justifica a posição na lista. */
export function motivoDaSugestao(classe: Classe, perfil: PerfilContato): string {
  const dias = perfil.diasSemResposta

  if (classe === 'em_risco') {
    return `Respondia antes e está há ${dias} dias em silêncio.`
  }
  if (classe === 'crescendo') {
    return `Respondeu ${perfil.recebidas} vezes e vem respondendo mais que antes.`
  }
  if (classe === 'engajado') {
    return `Respondeu há ${dias} dias; a conversa está viva.`
  }
  if (classe === 'inativo') {
    return `Sem resposta há ${dias} dias.`
  }
  return perfil.enviadas > 0
    ? `Recebeu ${perfil.enviadas} mensagens e nunca respondeu.`
    : 'Ainda não houve conversa.'
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/__tests__/inteligencia.test.ts`
Expected: PASS (18 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/inteligencia.ts lib/__tests__/inteligencia.test.ts
git commit -m "feat(inteligencia): classificação e pontuação explicáveis"
```

---

### Task 4: Consulta dos perfis

**Files:**
- Create: `lib/consultas/inteligencia.ts`
- Test: `lib/__tests__/consultas-inteligencia.test.ts`

**Interfaces:**
- Consumes: tudo da Task 3; `chaveDoNumero`.
- Produces:
```ts
export type ClienteAnalisado = {
  numero: string; nome: string; classe: Classe
  perfil: PerfilContato; pontos: number; motivo: string
}
export function montarAnalise(
  interacoes: { numero_chave: string; tipo: string; quando: string }[],
  contatos: { nome: string; numero: string }[],
  agora: Date,
): ClienteAnalisado[]
export async function listarClientesAnalisados(): Promise<ClienteAnalisado[]>
```

A montagem é função pura separada da busca, para poder ser testada sem banco — o mesmo padrão que `lib/resumo.ts` já usa em relação a `lib/consultas/resumo.ts`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/__tests__/consultas-inteligencia.test.ts
import { describe, expect, it } from 'vitest'
import { montarAnalise } from '@/lib/consultas/inteligencia'

const agora = new Date('2026-08-21T12:00:00.000Z')
const DIA = 24 * 60 * 60 * 1000
const atras = (d: number) => new Date(agora.getTime() - d * DIA).toISOString()

describe('montarAnalise', () => {
  it('agrupa interações por contato', () => {
    const r = montarAnalise(
      [
        { numero_chave: '556584038479', tipo: 'enviada', quando: atras(5) },
        { numero_chave: '556584038479', tipo: 'recebida', quando: atras(3) },
        { numero_chave: '5511999998888', tipo: 'enviada', quando: atras(2) },
      ],
      [],
      agora,
    )
    expect(r).toHaveLength(2)
  })

  // Nome do cadastro quando existe; o número cru quando não — o contato pode
  // ter escrito sem nunca ter sido cadastrado.
  it('usa o nome do contato quando ele está cadastrado', () => {
    const r = montarAnalise(
      [{ numero_chave: '556584038479', tipo: 'recebida', quando: atras(1) }],
      [{ nome: 'Matheus', numero: '5565984038479' }],
      agora,
    )
    expect(r[0].nome).toBe('Matheus')
  })

  it('cai no número quando não há cadastro', () => {
    const r = montarAnalise(
      [{ numero_chave: '556584038479', tipo: 'recebida', quando: atras(1) }],
      [],
      agora,
    )
    expect(r[0].nome).toBe('556584038479')
  })

  // O cadastro guarda com o nono dígito e a interação sem: casar cru perderia
  // o nome de todo mundo.
  it('casa o cadastro pela forma canônica do número', () => {
    const r = montarAnalise(
      [{ numero_chave: '556584038479', tipo: 'recebida', quando: atras(1) }],
      [{ nome: 'Matheus', numero: '+55 (65) 98403-8479' }],
      agora,
    )
    expect(r[0].nome).toBe('Matheus')
  })

  it('ordena do maior para o menor ponto', () => {
    const r = montarAnalise(
      [
        // engajado
        { numero_chave: '111', tipo: 'recebida', quando: atras(1) },
        // em risco — deve vir primeiro
        { numero_chave: '222', tipo: 'recebida', quando: atras(20) },
      ],
      [],
      agora,
    )
    expect(r[0].numero).toBe('222')
  })

  it('traz o motivo junto', () => {
    const r = montarAnalise(
      [{ numero_chave: '222', tipo: 'recebida', quando: atras(20) }],
      [],
      agora,
    )
    expect(r[0].motivo).toBeTruthy()
  })

  it('devolve vazio sem interação nenhuma', () => {
    expect(montarAnalise([], [], agora)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/__tests__/consultas-inteligencia.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/consultas/inteligencia.ts
import {
  classificar,
  motivoDaSugestao,
  pontuarContato,
  resumirInteracoes,
  type Classe,
  type LinhaInteracao,
  type PerfilContato,
} from '@/lib/inteligencia'
import { chaveDoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type ClienteAnalisado = {
  numero: string
  nome: string
  classe: Classe
  perfil: PerfilContato
  pontos: number
  motivo: string
}

/** Teto da varredura: acima disso a análise vira uma consulta pesada. */
const LIMITE_INTERACOES = 5000

/**
 * Junta interações e cadastro numa lista ordenada por prioridade.
 *
 * Pura e separada da busca, como `lib/resumo.ts` em relação a
 * `lib/consultas/resumo.ts`: a regra de negócio precisa de teste, a ida ao
 * banco não.
 */
export function montarAnalise(
  interacoes: { numero_chave: string; tipo: string; quando: string }[],
  contatos: { nome: string; numero: string }[],
  agora: Date,
): ClienteAnalisado[] {
  // O cadastro guarda o número como foi digitado; a interação, canônico.
  const nomePorChave = new Map(
    contatos.map((c) => [chaveDoNumero(c.numero), c.nome]),
  )

  const porContato = new Map<string, LinhaInteracao[]>()
  for (const linha of interacoes) {
    const chave = String(linha.numero_chave)
    const atual = porContato.get(chave)
    const item = { tipo: String(linha.tipo), quando: String(linha.quando) }
    if (atual) atual.push(item)
    else porContato.set(chave, [item])
  }

  const analisados: ClienteAnalisado[] = []

  for (const [numero, linhas] of porContato) {
    const perfil = resumirInteracoes(linhas, agora)
    const classe = classificar(perfil, linhas, agora)

    analisados.push({
      numero,
      nome: nomePorChave.get(numero) ?? numero,
      classe,
      perfil,
      pontos: pontuarContato(perfil, classe),
      motivo: motivoDaSugestao(classe, perfil),
    })
  }

  return analisados.sort((a, b) => b.pontos - a.pontos)
}

export async function listarClientesAnalisados(): Promise<ClienteAnalisado[]> {
  const supabase = await criarClienteServidor()

  const [interacoes, contatos] = await Promise.all([
    supabase
      .from('interacoes')
      .select('numero_chave, tipo, quando')
      .order('quando', { ascending: false })
      .limit(LIMITE_INTERACOES),
    supabase.from('contatos').select('nome, numero'),
  ])

  return montarAnalise(
    (interacoes.data ?? []).map((i) => ({
      numero_chave: String(i.numero_chave),
      tipo: String(i.tipo),
      quando: String(i.quando),
    })),
    (contatos.data ?? []).map((c) => ({
      nome: String(c.nome),
      numero: String(c.numero),
    })),
    new Date(),
  )
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/__tests__/consultas-inteligencia.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/consultas/inteligencia.ts lib/__tests__/consultas-inteligencia.test.ts
git commit -m "feat(inteligencia): consulta que monta a análise dos contatos"
```

---

### Task 5: Tela "Quem devo contatar hoje?"

**Files:**
- Create: `app/(app)/clientes/page.tsx`
- Create: `app/(app)/clientes/lista-clientes.tsx`
- Modify: `components/sidebar.tsx`
- Test: `app/(app)/clientes/__tests__/lista-clientes.test.tsx`

**Interfaces:**
- Consumes: `ClienteAnalisado`, `ROTULO_CLASSE`.
- Produces: componente `ListaClientes({ clientes }: { clientes: ClienteAnalisado[] })`.

- [ ] **Step 1: Escrever o teste falhando**

```tsx
// app/(app)/clientes/__tests__/lista-clientes.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ListaClientes } from '@/app/(app)/clientes/lista-clientes'
import type { ClienteAnalisado } from '@/lib/consultas/inteligencia'

function cliente(sobrepor: Partial<ClienteAnalisado> = {}): ClienteAnalisado {
  return {
    numero: '556584038479',
    nome: 'Matheus',
    classe: 'em_risco',
    pontos: 105,
    motivo: 'Respondia antes e está há 20 dias em silêncio.',
    perfil: {
      recebidas: 3,
      enviadas: 4,
      lidas: 2,
      ultimaEntrada: '2026-08-01T12:00:00.000Z',
      ultimaSaida: '2026-08-10T12:00:00.000Z',
      taxaResposta: 0.75,
      diasSemResposta: 20,
    },
    ...sobrepor,
  }
}

describe('lista de clientes', () => {
  it('mostra nome, classe e motivo', () => {
    render(<ListaClientes clientes={[cliente()]} />)

    expect(screen.getByText('Matheus')).toBeInTheDocument()
    expect(screen.getByText('Em risco')).toBeInTheDocument()
    expect(screen.getByText(/20 dias em silêncio/)).toBeInTheDocument()
  })

  // Sem o motivo visível, a lista vira palpite e ninguém usa.
  it('mostra um motivo para cada linha', () => {
    render(
      <ListaClientes
        clientes={[
          cliente(),
          cliente({ numero: '111', nome: 'Ana', classe: 'engajado', motivo: 'Respondeu há 2 dias; a conversa está viva.' }),
        ]}
      />,
    )
    expect(screen.getByText(/conversa está viva/)).toBeInTheDocument()
  })

  it('leva para a conversa do contato', () => {
    render(<ListaClientes clientes={[cliente()]} />)
    expect(screen.getByRole('link', { name: /Matheus/ })).toHaveAttribute(
      'href',
      '/mensagens/556584038479',
    )
  })

  it('filtra por classe', async () => {
    render(
      <ListaClientes
        clientes={[
          cliente(),
          cliente({ numero: '111', nome: 'Ana', classe: 'engajado' }),
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Engajado' }))

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.queryByText('Matheus')).not.toBeInTheDocument()
  })

  // Sem histórico a tela precisa explicar, não parecer quebrada — e hoje o
  // banco está exatamente assim.
  it('explica quando não há dados', () => {
    render(<ListaClientes clientes={[]} />)
    expect(screen.getByText(/ainda não há histórico/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/clientes/__tests__/lista-clientes.test.tsx'`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```tsx
// app/(app)/clientes/lista-clientes.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ClienteAnalisado } from '@/lib/consultas/inteligencia'
import { ROTULO_CLASSE, type Classe } from '@/lib/inteligencia'
import { cn } from '@/lib/utils'

/** Mesma lógica de cor dos estados de conversa: urgência quente, calmaria fria. */
const ESTILO: Record<Classe, string> = {
  em_risco: 'bg-destructive/15 text-destructive',
  crescendo: 'bg-primary/15 text-primary',
  engajado: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  novo: 'bg-muted text-muted-foreground',
  inativo: 'bg-muted text-muted-foreground',
}

const CLASSES: Classe[] = ['em_risco', 'crescendo', 'engajado', 'novo', 'inativo']

export function ListaClientes({ clientes }: { clientes: ClienteAnalisado[] }) {
  const [filtro, setFiltro] = useState<Classe | 'todas'>('todas')

  const lista =
    filtro === 'todas' ? clientes : clientes.filter((c) => c.classe === filtro)

  if (clientes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há histórico suficiente para analisar. As interações começam a
        ser registradas conforme as conversas acontecem.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={filtro === 'todas' ? 'default' : 'outline'}
          size="xs"
          onClick={() => setFiltro('todas')}
        >
          Todas
        </Button>
        {CLASSES.map((c) => (
          <Button
            key={c}
            variant={filtro === c ? 'default' : 'outline'}
            size="xs"
            onClick={() => setFiltro(c)}
          >
            {ROTULO_CLASSE[c]}
          </Button>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {lista.map((c) => (
          <li key={c.numero}>
            <Link
              href={`/mensagens/${c.numero}`}
              className="flex items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {c.nome}
                  </span>
                  <Badge className={cn('shrink-0 text-[11px]', ESTILO[c.classe])}>
                    {ROTULO_CLASSE[c.classe]}
                  </Badge>
                </span>
                {/* O motivo é o que faz a lista ser usada em vez de ignorada:
                    sem ele a ordenação vira palpite. */}
                <span className="block text-xs text-muted-foreground">
                  {c.motivo}
                </span>
              </span>

              <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {Math.round(c.perfil.taxaResposta * 100)}%
                <span className="block text-[11px]">resposta</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

> Ao executar: conferir se `Badge` e `Button` aceitam as variantes usadas acima abrindo `components/ui/`. `size="xs"` já é usado no sino de notificações, então existe.

```tsx
// app/(app)/clientes/page.tsx
import { listarClientesAnalisados } from '@/lib/consultas/inteligencia'
import { ListaClientes } from './lista-clientes'

export default async function Page() {
  const clientes = await listarClientesAnalisados()
  return <ListaClientes clientes={clientes} />
}
```

Acrescentar `Clientes` à barra lateral, no formato dos itens existentes.

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/clientes/__tests__/lista-clientes.test.tsx'`
Expected: PASS (5 testes)

- [ ] **Step 5: Typecheck, suíte e build**

Run: `npx tsc --noEmit && npm run test:run && npm run build`
Expected: os três limpos. Restaurar `next-env.d.ts` antes de commitar.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(clientes): tela de quem contatar hoje, com o motivo à vista"
```

---

### Task 6: Selo de classe na conversa e na esteira

**Files:**
- Modify: `app/(app)/mensagens/lista-conversas.tsx`
- Modify: `app/(app)/esteira/quadro.tsx` (se o plano de chat e esteira já estiver aplicado)
- Test: ajustes nos testes desses dois componentes

**Interfaces:**
- Consumes: `ClienteAnalisado`, `ROTULO_CLASSE`.

A análise só vira hábito se aparecer onde a pessoa já trabalha. Esta task leva o selo de classe para a lista de conversas e para o cartão da esteira — sem consulta nova: as duas páginas passam a chamar `listarClientesAnalisados()` em paralelo com o que já buscam, e casam por `chaveDoNumero`.

- [ ] **Step 1: Escrever o teste falhando**

Acrescentar ao teste de `lista-conversas`:

```tsx
it('mostra o selo de classe do contato', () => {
  render(
    <ListaConversas
      conversas={[/* conversa de 556584038479 */]}
      buscaInicial=""
      classes={{ '556584038479': 'em_risco' }}
    />,
  )
  expect(screen.getByText('Em risco')).toBeInTheDocument()
})

// Contato sem histórico não pode ganhar selo inventado.
it('não mostra selo para quem não tem classe', () => {
  render(
    <ListaConversas
      conversas={[/* mesma conversa */]}
      buscaInicial=""
      classes={{}}
    />,
  )
  expect(screen.queryByText('Em risco')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar, implementar, confirmar verde**

Run: `npx vitest run 'app/(app)/mensagens/__tests__'`

Passar `classes` como `Record<string, Classe>` do servidor, montado a partir de `listarClientesAnalisados()`.

- [ ] **Step 3: Typecheck, suíte e commit**

```bash
npx tsc --noEmit && npm run test:run
git add -A
git commit -m "feat(inteligencia): selo de classe na lista de conversas e na esteira"
```

---

### Task 7 (OPCIONAL): Rastreio de cliques

**Não faça esta task sem decidir conscientemente pelo custo abaixo.**

Rastrear clique exige reescrever os links das mensagens enviadas, trocando `https://seusite.com/promo` por `https://seuapp.com/r/abc123`. No WhatsApp isso tem três efeitos que não dá para evitar:

1. **Parece encurtador de spam.** O contato vê um domínio que não é o da marca, e a taxa de clique cai justamente por isso.
2. **Aumenta o risco de bloqueio** — link redirecionado em massa é sinal clássico de disparo, contra o que o plano de ritmo trabalha.
3. **Quebra a pré-visualização** do link no WhatsApp, que hoje mostra título e imagem do destino.

Em troca, você ganha um sinal a mais na classificação. **Minha recomendação é não fazer**, e usar taxa de resposta e leitura, que já capturam interesse sem custo nenhum. Se ainda assim for feito:

**Files:**
- Create: `supabase/migrations/0018_links.sql` (tabela `links_rastreados`: id curto, owner_id, url_destino, numero_chave, criado_em)
- Create: `app/r/[codigo]/route.ts` (rota pública de redirecionamento)
- Create: `lib/inteligencia/links.ts` (`reescreverLinks(texto, criarCodigo)`, pura e testável)
- Modify: `lib/disparos/processador.ts` e `app/(app)/mensagens/actions.ts`

- [ ] **Step 1:** Teste de `reescreverLinks`: reescreve http e https, preserva texto sem link, preserva pontuação colada ao fim da URL, não reescreve o próprio domínio de redirecionamento (evita laço), e devolve o texto intacto quando não há link.
- [ ] **Step 2:** Rodar e confirmar que falha.
- [ ] **Step 3:** Implementar a função pura.
- [ ] **Step 4:** Migration e rota `/r/[codigo]`, que grava `clique` via `registrarInteracao` e responde `307` para o destino. A rota é **pública** — acrescentar `/r` a `ROTAS_PUBLICAS` em `lib/supabase/middleware.ts`, senão o middleware manda o contato para a tela de login.
- [ ] **Step 5:** Ligar aos dois pontos de envio.
- [ ] **Step 6:** Typecheck, suíte, commit.

---

## Verificação final

- [ ] `npm run test:run` — suíte verde
- [ ] `npx tsc --noEmit` — limpo
- [ ] `npm run build` — completo
- [ ] Mensagem recebida gera linha em `interacoes` com o número canônico
- [ ] Recibo de leitura gera linha `lida`
- [ ] **Remover uma conexão apaga `mensagens` e NÃO apaga `interacoes`** — é o teste que justifica o desenho inteiro
- [ ] A tela de Clientes ordena com "em risco" no topo e mostra o motivo de cada um
- [ ] `git status` limpo

## O que este plano deliberadamente NÃO faz

- **Não usa IA nem modelo estatístico.** Regra explícita é auditável e ajustável; modelo treinado em dezenas de contatos seria teatro.
- **Não recalcula em tempo real.** A análise roda na carga da tela, sobre no máximo 5000 interações. Quando isso pesar, vira view materializada — e não antes.
- **Não rastreia cliques por padrão.** Ver Task 7.
- **Não muda a decisão do cascade.** `mensagens` continua sendo apagada com a conexão; `interacoes` é que sobrevive, por não ter FK para `instances`.
- **Não chuta calibragem.** As constantes no topo de `lib/inteligencia.ts` foram escolhidas sem dados e vão precisar de ajuste. Isso é esperado, está documentado no módulo, e é a razão de elas estarem todas num lugar só.
