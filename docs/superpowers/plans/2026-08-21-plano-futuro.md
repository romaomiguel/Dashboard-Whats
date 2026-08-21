# Plano Futuro — Troca de Provedor de WhatsApp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o acoplamento direto com a Evolution API v2 numa interface de provedor com três implementações — Evolution v2, Evolution Go e WuZAPI — escolhível por conexão.

**Architecture:** Hoje `lib/evolution/` (409 linhas, 7 arquivos) já concentra as chamadas de saída, mas a rota de webhook conhece o formato da Evolution de ponta a ponta. O plano vira `lib/evolution/` numa implementação de uma interface `ProvedorWhatsApp` e extrai a leitura de webhook para um tradutor por provedor, que devolve um **evento neutro**. A gravação de mensagem, o registro de notificação e as telas não mudam: elas já trabalham com dados normalizados.

**Tech Stack:** Next.js 16.3 (App Router, `proxy.ts`), TypeScript, Supabase (Postgres + RLS), Vitest + Testing Library.

**Spec:** Este plano é auto-contido. A análise que o originou está no artifact “Trocar a Evolution” (https://claude.ai/code/artifact/30abd387-d7a5-481e-8df4-c29fc367fce5), com as medições de acoplamento e a comparação entre os três provedores.

## Global Constraints

- **Comentários em português**, explicando *por que*, no estilo já usado no repo. Nunca comentar o óbvio.
- **Nomes de domínio em português** (`provedor`, `identificador`, `enviarTexto`), como o resto do código.
- **TDD**: teste falhando antes de qualquer implementação. A suíte hoje tem 320 testes em 31 arquivos; ela deve terminar verde a cada task.
- **`npx tsc --noEmit` limpo** ao fim de cada task.
- **Nunca quebrar a instância em produção**: a Evolution v2.3.7 já registrada aponta para `/api/webhooks/evolution/{segredo}`. Essa rota tem de continuar respondendo até a Task 5 terminar, e a Task 5 mantém compatibilidade explícita.
- **Ler `node_modules/next/dist/docs/`** antes de mexer em rota, proxy ou server action — o `AGENTS.md` do repo exige, porque esta versão do Next tem quebras em relação ao conhecimento pré-treinado.
- **`AGENTS.md` reescrito por `next dev`**: se aparecer no diff, commitar junto em vez de reverter.
- Commits frequentes, um por task, mensagem no estilo do repo (`feat:` / `fix:` / `refactor:`) terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Decisões já tomadas (não reabrir durante a execução)

1. **`instances.evolution_name` não é renomeada.** Ela passa a guardar o identificador externo de qualquer provedor. Renomear tocaria consultas em 6+ arquivos sem ganho funcional; a migration documenta o novo significado. O custo é um nome levemente enganoso, aceito conscientemente.
2. **A coluna `instances.token`, que já existe e está sempre nula, passa a ser usada de fato** — a WuZAPI precisa de um token por usuário.
3. **Evolution Go entra como terceira implementação, não como substituição.** Ela não é drop-in da v2 (`/instance/all` contra `/instance/fetchInstances`, QR em endpoint próprio), então conviver é mais barato que migrar.
4. **A rota de webhook antiga continua viva.** Instâncias já registradas na Evolution têm a URL antiga gravada lá dentro; quebrar isso derrubaria a conexão em produção.

---

## Estrutura de arquivos

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0014_provedor.sql` | Coluna `provedor` em `instances`, com check |
| `lib/whatsapp/provedor.ts` | A interface `ProvedorWhatsApp` e os tipos que ela troca |
| `lib/whatsapp/eventos.ts` | `EventoNeutro` — o que todo tradutor devolve |
| `lib/whatsapp/registro.ts` | `provedorPara(nome)` — resolve nome → implementação |
| `lib/whatsapp/evolution/traduzir.ts` | Payload da Evolution v2 → `EventoNeutro` |
| `lib/whatsapp/evolution/provedor.ts` | Evolution v2 implementando a interface |
| `lib/whatsapp/evolution-go/*` | Idem, para Evolution Go |
| `lib/whatsapp/wuzapi/*` | Idem, para WuZAPI |
| `lib/whatsapp/gravar.ts` | `EventoNeutro` → banco (extraído da rota atual) |
| `app/api/webhooks/[provedor]/[segredo]/route.ts` | Rota única, despacha por provedor |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `app/api/webhooks/evolution/[segredo]/route.ts` | Vira casca fina que delega ao caminho novo |
| `app/(app)/conexao/actions.ts` | Usa o registro em vez de importar `lib/evolution` |
| `lib/disparos/processador.ts` | Idem |
| `lib/consultas/conexao.ts` | Passa a ler `provedor` |

**Preservado sem tocar:** `lib/evolution/jid.ts` (JID e nono dígito são protocolo do WhatsApp, valem igual para whatsmeow), `lib/notificacoes/registrar.ts`, `lib/consultas/mensagens.ts`, todas as telas.

---

### Task 1: Coluna de provedor

**Files:**
- Create: `supabase/migrations/0014_provedor.sql`
- Create: `lib/whatsapp/provedores.ts`
- Test: `lib/whatsapp/__tests__/provedores.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `NOMES_PROVEDOR: readonly ['evolution','evolution-go','wuzapi']`, `type NomeProvedor`, `ehNomeProvedor(v: string): v is NomeProvedor`, `PROVEDOR_PADRAO: NomeProvedor`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/whatsapp/__tests__/provedores.test.ts
import { describe, expect, it } from 'vitest'
import {
  ehNomeProvedor,
  NOMES_PROVEDOR,
  PROVEDOR_PADRAO,
} from '@/lib/whatsapp/provedores'

describe('nomes de provedor', () => {
  it('lista os três provedores suportados', () => {
    expect([...NOMES_PROVEDOR]).toEqual(['evolution', 'evolution-go', 'wuzapi'])
  })

  // O padrão precisa ser a Evolution v2: é o que as linhas já gravadas usam,
  // e a migration 0014 preenche o retroativo com ele.
  it('assume evolution para o que já existia', () => {
    expect(PROVEDOR_PADRAO).toBe('evolution')
  })

  it('reconhece nome válido', () => {
    expect(ehNomeProvedor('wuzapi')).toBe(true)
  })

  // Vem de coluna de banco e de segmento de URL: string arbitrária chega aqui.
  it('recusa o que não está na lista', () => {
    expect(ehNomeProvedor('baileys')).toBe(false)
    expect(ehNomeProvedor('')).toBe(false)
  })

  // Acesso por colchetes em objeto herda de Object.prototype; o guard tem de
  // barrar isso, como já fizemos em PREFERENCIA_POR_TIPO.
  it('recusa nome herdado de Object.prototype', () => {
    expect(ehNomeProvedor('constructor')).toBe(false)
    expect(ehNomeProvedor('toString')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/whatsapp/__tests__/provedores.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/whatsapp/provedores"`

- [ ] **Step 3: Implementar**

```ts
// lib/whatsapp/provedores.ts

/**
 * Provedores de WhatsApp que o app sabe conversar.
 *
 * Evolution v2 é o que está em produção. Evolution Go e WuZAPI usam
 * `whatsmeow` em vez de Baileys — o ganho é por conexão (sessão estável em
 * uptime longo, RAM previsível), não latência.
 */
export const NOMES_PROVEDOR = ['evolution', 'evolution-go', 'wuzapi'] as const

export type NomeProvedor = (typeof NOMES_PROVEDOR)[number]

/** O que as conexões criadas antes da 0014 usam. */
export const PROVEDOR_PADRAO: NomeProvedor = 'evolution'

/**
 * `includes` e não indexação por colchetes: o valor chega de coluna de banco
 * e de segmento de URL, e `NOMES['constructor']` devolveria função em vez de
 * undefined.
 */
export function ehNomeProvedor(valor: string): valor is NomeProvedor {
  return (NOMES_PROVEDOR as readonly string[]).includes(valor)
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/whatsapp/__tests__/provedores.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Escrever a migration**

```sql
-- supabase/migrations/0014_provedor.sql

-- Qual API de WhatsApp atende esta conexão.
--
-- Evolution v2 é o que existia; o default preenche o retroativo sem
-- precisar de UPDATE. Evolution Go e WuZAPI falam whatsmeow e entram como
-- implementações irmãs, não como substituição — a Go não é drop-in da v2
-- (lista instâncias em /instance/all, e o QR tem endpoint próprio).
alter table public.instances
  add column provedor text not null default 'evolution';

alter table public.instances
  add constraint provedor_conhecido
  check (provedor in ('evolution', 'evolution-go', 'wuzapi'));

-- evolution_name passa a guardar o identificador externo de QUALQUER
-- provedor (nome de instância na Evolution, id de usuário na WuZAPI). O nome
-- da coluna fica: renomear tocaria consulta em seis arquivos sem ganho
-- funcional.
comment on column public.instances.evolution_name is
  'Identificador da instância no provedor (ver coluna provedor).';

-- A coluna token existe desde a 0001 e está sempre nula: a Evolution usa uma
-- apikey global. A WuZAPI dá um token por usuário, e é aqui que ele vai.
comment on column public.instances.token is
  'Token por instância; usado pela WuZAPI, nulo na Evolution.';
```

- [ ] **Step 6: Aplicar no Supabase e conferir**

Aplicar `0014_provedor.sql` pelo SQL Editor do Supabase. Depois conferir que a linha existente ganhou o default:

```bash
set -a; . ./.env; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/instances?select=id,evolution_name,provedor" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: cada linha com `"provedor":"evolution"`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0014_provedor.sql lib/whatsapp/
git commit -m "feat(provedor): coluna de provedor e os nomes suportados"
```

---

### Task 2: O evento neutro

**Files:**
- Create: `lib/whatsapp/eventos.ts`
- Test: `lib/whatsapp/__tests__/eventos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type EstadoConexao = 'open'|'connecting'|'close'`, `type EventoNeutro`, `POSICAO_RECIBO: Record<string, number>`, `reciboAvanca(atual: string, novo: 'entregue'|'lida'): boolean`.

Este é o contrato que todo tradutor de webhook produz. É a peça que permite a mesma gravação servir três provedores.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/whatsapp/__tests__/eventos.test.ts
import { describe, expect, it } from 'vitest'
import { reciboAvanca } from '@/lib/whatsapp/eventos'

describe('reciboAvanca', () => {
  // Fora de ordem acontece: leitura pode chegar antes da entrega, e um
  // recibo nunca pode rebaixar o que já se sabe.
  it('deixa avançar no funil', () => {
    expect(reciboAvanca('enviada', 'entregue')).toBe(true)
    expect(reciboAvanca('entregue', 'lida')).toBe(true)
  })

  it('não deixa retroceder', () => {
    expect(reciboAvanca('lida', 'entregue')).toBe(false)
  })

  it('não reescreve o mesmo estado', () => {
    expect(reciboAvanca('entregue', 'entregue')).toBe(false)
  })

  // 'recebida' e 'falhou' não estão no funil de saída; recibo sobre elas não
  // faz sentido e não pode escrever.
  it('ignora status fora do funil de saída', () => {
    expect(reciboAvanca('recebida', 'lida')).toBe(true)
    expect(reciboAvanca('falhou', 'entregue')).toBe(true)
  })
})
```

> Nota para quem executa: os dois últimos casos afirmam `true` de propósito — status desconhecido vale 0 no funil, então qualquer recibo avança. É o comportamento da rota atual (`POSICAO[...] ?? 0`) e este teste o congela; não “corrigir” para `false`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/whatsapp/__tests__/eventos.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/whatsapp/eventos"`

- [ ] **Step 3: Implementar**

```ts
// lib/whatsapp/eventos.ts

/** Estado de conexão, no vocabulário que a Evolution já usava. */
export type EstadoConexao = 'open' | 'connecting' | 'close'

/**
 * O que qualquer provedor entrega, depois de traduzido.
 *
 * Existe para que a gravação no banco não conheça formato de webhook: a
 * Evolution manda `messages.upsert` com `data.key`, a WuZAPI manda `Message`
 * com outra forma, e as duas viram isto.
 *
 * `identificador` é a instância no provedor — casa com
 * `instances.evolution_name`.
 */
export type EventoNeutro =
  | {
      tipo: 'mensagem'
      identificador: string
      numero: string
      nome: string | null
      texto: string
      chave: string | null
      daPropriaConta: boolean
    }
  | {
      tipo: 'recibo'
      identificador: string
      chave: string
      status: 'entregue' | 'lida'
    }
  | {
      tipo: 'conexao'
      identificador: string
      estado: EstadoConexao
    }

/** Ordem do funil de saída: um recibo nunca rebaixa o que já se sabe. */
const POSICAO: Record<string, number> = {
  enviada: 1,
  entregue: 2,
  lida: 3,
}

/**
 * Se este recibo acrescenta informação ao status atual.
 *
 * Status fora do funil (`recebida`, `falhou`) vale 0 e deixa qualquer recibo
 * passar — é o comportamento que a rota tinha, preservado aqui.
 */
export function reciboAvanca(
  atual: string,
  novo: 'entregue' | 'lida',
): boolean {
  return (POSICAO[atual] ?? 0) < POSICAO[novo]
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/whatsapp/__tests__/eventos.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp/eventos.ts lib/whatsapp/__tests__/eventos.test.ts
git commit -m "feat(provedor): evento neutro que todo tradutor produz"
```

---

### Task 3: Tradutor da Evolution v2

**Files:**
- Create: `lib/whatsapp/evolution/traduzir.ts`
- Test: `lib/whatsapp/evolution/__tests__/traduzir.test.ts`
- Read (não modificar ainda): `app/api/webhooks/evolution/[segredo]/route.ts:8-148`

**Interfaces:**
- Consumes: `EventoNeutro`, `EstadoConexao` da Task 2; `numeroDoContato`, `ChaveMensagem` de `@/lib/evolution/jid`.
- Produces: `traduzirEvolution(bruto: unknown): EventoNeutro | null`.

Esta task **move** a lógica que hoje mora dentro da rota (`textoDaMensagem`, o mapeamento `DELIVERY_ACK`/`READ`/`PLAYED`, os nomes de evento) para uma função pura e testável. Comportamento idêntico — o valor é ficar testável e substituível.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/whatsapp/evolution/__tests__/traduzir.test.ts
import { describe, expect, it } from 'vitest'
import { traduzirEvolution } from '@/lib/whatsapp/evolution/traduzir'

function evento(tipo: string, data: unknown) {
  return { event: tipo, instance: 'inst_abc', data }
}

describe('mensagem', () => {
  it('lê texto simples de contato', () => {
    const r = traduzirEvolution(
      evento('messages.upsert', {
        key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false, id: 'K1' },
        pushName: 'Matheus',
        message: { conversation: 'Oi' },
      }),
    )
    expect(r).toEqual({
      tipo: 'mensagem',
      identificador: 'inst_abc',
      numero: '556584038479',
      nome: 'Matheus',
      texto: 'Oi',
      chave: 'K1',
      daPropriaConta: false,
    })
  })

  it('lê extendedTextMessage', () => {
    const r = traduzirEvolution(
      evento('messages.upsert', {
        key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false },
        message: { extendedTextMessage: { text: 'com citação' } },
      }),
    )
    expect(r).toMatchObject({ texto: 'com citação', chave: null })
  })

  // Mídia sem legenda ainda merece aparecer na conversa.
  it('rotula mídia sem legenda', () => {
    const r = traduzirEvolution(
      evento('messages.upsert', {
        key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false },
        message: { imageMessage: {} },
      }),
    )
    expect(r).toMatchObject({ texto: '[mídia]' })
  })

  it('usa a legenda da mídia quando existe', () => {
    const r = traduzirEvolution(
      evento('messages.upsert', {
        key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false },
        message: { imageMessage: { caption: 'olha isso' } },
      }),
    )
    expect(r).toMatchObject({ texto: 'olha isso' })
  })

  it('rotula áudio', () => {
    const r = traduzirEvolution(
      evento('messages.upsert', {
        key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false },
        message: { audioMessage: {} },
      }),
    )
    expect(r).toMatchObject({ texto: '[áudio]' })
  })

  // pushName é de quem enviou: numa mensagem própria seria o nome do
  // usuário, não o do contato.
  it('não atribui nome à mensagem própria', () => {
    const r = traduzirEvolution(
      evento('messages.upsert', {
        key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: true },
        pushName: 'Eu mesmo',
        message: { conversation: 'saiu do celular' },
      }),
    )
    expect(r).toMatchObject({ daPropriaConta: true, nome: null })
  })

  it('descarta grupo', () => {
    expect(
      traduzirEvolution(
        evento('messages.upsert', {
          key: { remoteJid: '12345@g.us', fromMe: false },
          message: { conversation: 'oi grupo' },
        }),
      ),
    ).toBeNull()
  })

  it('descarta mensagem sem texto legível', () => {
    expect(
      traduzirEvolution(
        evento('messages.upsert', {
          key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false },
          message: { reactionMessage: {} },
        }),
      ),
    ).toBeNull()
  })
})

describe('recibo', () => {
  it('traduz DELIVERY_ACK', () => {
    expect(
      traduzirEvolution(evento('messages.update', { key: { id: 'K1' }, status: 'DELIVERY_ACK' })),
    ).toEqual({ tipo: 'recibo', identificador: 'inst_abc', chave: 'K1', status: 'entregue' })
  })

  it('traduz READ e PLAYED como lida', () => {
    expect(
      traduzirEvolution(evento('messages.update', { key: { id: 'K1' }, status: 'READ' })),
    ).toMatchObject({ status: 'lida' })
    expect(
      traduzirEvolution(evento('messages.update', { key: { id: 'K2' }, status: 'PLAYED' })),
    ).toMatchObject({ status: 'lida' })
  })

  it('ignora status sem significado de funil', () => {
    expect(
      traduzirEvolution(evento('messages.update', { key: { id: 'K1' }, status: 'PENDING' })),
    ).toBeNull()
  })

  it('ignora recibo sem chave', () => {
    expect(
      traduzirEvolution(evento('messages.update', { status: 'READ' })),
    ).toBeNull()
  })
})

describe('conexão', () => {
  it('traduz open', () => {
    expect(
      traduzirEvolution(evento('connection.update', { state: 'open' })),
    ).toEqual({ tipo: 'conexao', identificador: 'inst_abc', estado: 'open' })
  })

  it('traduz close', () => {
    expect(
      traduzirEvolution(evento('connection.update', { state: 'close' })),
    ).toMatchObject({ estado: 'close' })
  })
})

describe('robustez', () => {
  // A rota devolve 200 para qualquer coisa: erro faz a Evolution reenviar em
  // laço. O tradutor precisa aguentar lixo sem lançar.
  it('devolve null para evento desconhecido', () => {
    expect(traduzirEvolution(evento('contacts.upsert', {}))).toBeNull()
  })

  it('devolve null para payload sem forma', () => {
    expect(traduzirEvolution(null)).toBeNull()
    expect(traduzirEvolution({})).toBeNull()
    expect(traduzirEvolution('texto')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/whatsapp/evolution/__tests__/traduzir.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/whatsapp/evolution/traduzir"`

- [ ] **Step 3: Implementar**

```ts
// lib/whatsapp/evolution/traduzir.ts
import { numeroDoContato, type ChaveMensagem } from '@/lib/evolution/jid'
import type { EventoNeutro } from '@/lib/whatsapp/eventos'

/** Texto da mensagem, nas formas que a Evolution usa conforme o tipo. */
function textoDaMensagem(dados: unknown): string | null {
  if (!dados || typeof dados !== 'object') return null
  const m = (dados as { message?: Record<string, unknown> }).message
  if (!m) return null

  if (typeof m.conversation === 'string') return m.conversation
  const estendida = m.extendedTextMessage as { text?: string } | undefined
  if (typeof estendida?.text === 'string') return estendida.text

  // Mídia sem legenda ainda merece aparecer na conversa.
  for (const chave of ['imageMessage', 'videoMessage', 'documentMessage']) {
    const parte = m[chave] as { caption?: string } | undefined
    if (parte) return parte.caption ?? '[mídia]'
  }
  if (m.audioMessage) return '[áudio]'
  return null
}

type Bruto = {
  event?: unknown
  instance?: unknown
  data?: unknown
}

/**
 * Payload da Evolution v2 → evento neutro.
 *
 * Pura de propósito: era o miolo da rota de webhook, onde só dava para
 * exercitar com requisição de verdade. Devolve `null` para tudo que não
 * interessa — a rota responde 200 de qualquer jeito, porque erro faz a
 * Evolution reenviar em laço.
 */
export function traduzirEvolution(bruto: unknown): EventoNeutro | null {
  if (!bruto || typeof bruto !== 'object') return null

  const { event, instance, data } = bruto as Bruto
  if (typeof event !== 'string' || typeof instance !== 'string') return null

  const tipo = event.toUpperCase().replace('.', '_')

  if (tipo === 'MESSAGES_UPSERT') {
    const dados = data as
      | { key?: ChaveMensagem & { id?: string }; pushName?: string }
      | null
      | undefined
    if (!dados?.key) return null

    // Trata os dois endereçamentos do WhatsApp, o antigo e o LID; descarta
    // grupo, transmissão e newsletter.
    const numero = numeroDoContato(dados.key)
    if (!numero) return null

    const texto = textoDaMensagem(data)
    if (!texto) return null

    const daPropriaConta = Boolean(dados.key.fromMe)

    return {
      tipo: 'mensagem',
      identificador: instance,
      numero,
      // pushName é de quem enviou: numa mensagem própria seria o nome do
      // usuário, não o do contato.
      nome: daPropriaConta ? null : (dados.pushName ?? null),
      texto,
      chave: dados.key.id ? String(dados.key.id) : null,
      daPropriaConta,
    }
  }

  if (tipo === 'MESSAGES_UPDATE') {
    const dados = data as { key?: { id?: string }; status?: string } | null
    const chave = dados?.key?.id
    if (!chave) return null

    const cru = String(dados?.status ?? '').toUpperCase()
    const status =
      cru === 'READ' || cru === 'PLAYED'
        ? 'lida'
        : cru === 'DELIVERY_ACK'
          ? 'entregue'
          : null

    if (!status) return null

    return { tipo: 'recibo', identificador: instance, chave: String(chave), status }
  }

  if (tipo === 'CONNECTION_UPDATE') {
    const dados = data as { state?: string } | null
    const estado = String(dados?.state ?? '')
    // A comparação com os três literais já estreita o tipo: nenhum cast.
    if (estado !== 'open' && estado !== 'connecting' && estado !== 'close') {
      return null
    }
    return { tipo: 'conexao', identificador: instance, estado }
  }

  return null
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/whatsapp/evolution/__tests__/traduzir.test.ts`
Expected: PASS (16 testes)

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm run test:run`
Expected: PASS. Nada foi removido ainda — a rota antiga continua com sua cópia da lógica.

- [ ] **Step 6: Commit**

```bash
git add lib/whatsapp/evolution/
git commit -m "feat(provedor): tradutor de webhook da Evolution como função pura"
```

---

### Task 4: Gravação a partir do evento neutro

**Files:**
- Create: `lib/whatsapp/gravar.ts`
- Test: `lib/whatsapp/__tests__/gravar.test.ts`
- Read: `app/api/webhooks/evolution/[segredo]/route.ts:40-201`

**Interfaces:**
- Consumes: `EventoNeutro`, `reciboAvanca` (Task 2); `registrarNotificacao` de `@/lib/notificacoes/registrar`; `deveNotificarQueda` de `@/lib/notificacoes`.
- Produces: `aplicarEvento(db: SupabaseClient, evento: EventoNeutro): Promise<void>`.

Move `registrarRecebida`, `registrarRecibo` e `registrarConexao` da rota para cá, agora falando `EventoNeutro` em vez de payload da Evolution. **Comportamento idêntico**, incluindo o `console.error` que hoje engole falha de gravação.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/whatsapp/__tests__/gravar.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aplicarEvento } from '@/lib/whatsapp/gravar'

const estado = vi.hoisted(() => ({
  instancia: null as Record<string, unknown> | null,
  mensagem: null as Record<string, unknown> | null,
  upserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  notificacoes: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/notificacoes/registrar', () => ({
  registrarNotificacao: async (
    _db: unknown,
    ownerId: string,
    evento: Record<string, unknown>,
  ) => {
    estado.notificacoes.push({ ownerId, ...evento })
    return true
  },
}))

function db() {
  return {
    from(tabela: string) {
      const encadeado = {
        select: () => encadeado,
        eq: () => encadeado,
        maybeSingle: async () => ({
          data: tabela === 'instances' ? estado.instancia : estado.mensagem,
        }),
        upsert: async (valores: Record<string, unknown>) => {
          estado.upserts.push({ tabela, ...valores })
          return { error: null }
        },
        update: (valores: Record<string, unknown>) => {
          estado.updates.push({ tabela, ...valores })
          return { eq: async () => ({ error: null }) }
        },
      }
      return encadeado
    },
  } as never
}

beforeEach(() => {
  estado.instancia = {
    id: 'inst-uuid',
    owner_id: 'user-1',
    nome: 'teste',
    status: 'conectada',
  }
  estado.mensagem = null
  estado.upserts = []
  estado.updates = []
  estado.notificacoes = []
})

describe('mensagem', () => {
  it('grava a entrada e notifica', async () => {
    await aplicarEvento(db(), {
      tipo: 'mensagem',
      identificador: 'inst_abc',
      numero: '556584038479',
      nome: 'Matheus',
      texto: 'Oi',
      chave: 'K1',
      daPropriaConta: false,
    })

    expect(estado.upserts.at(-1)).toMatchObject({
      tabela: 'mensagens',
      owner_id: 'user-1',
      numero: '556584038479',
      direcao: 'entrada',
      status: 'recebida',
      mensagem_key: 'K1',
    })
    expect(estado.notificacoes).toHaveLength(1)
  })

  // O que sai do próprio número não é novidade para quem enviou.
  it('grava a saída sem notificar', async () => {
    await aplicarEvento(db(), {
      tipo: 'mensagem',
      identificador: 'inst_abc',
      numero: '556584038479',
      nome: null,
      texto: 'respondi pelo celular',
      chave: 'K2',
      daPropriaConta: true,
    })

    expect(estado.upserts.at(-1)).toMatchObject({
      direcao: 'saida',
      status: 'enviada',
    })
    expect(estado.notificacoes).toHaveLength(0)
  })

  it('não faz nada quando a instância não é conhecida', async () => {
    estado.instancia = null
    await aplicarEvento(db(), {
      tipo: 'mensagem',
      identificador: 'sumida',
      numero: '556584038479',
      nome: null,
      texto: 'Oi',
      chave: 'K1',
      daPropriaConta: false,
    })

    expect(estado.upserts).toHaveLength(0)
    expect(estado.notificacoes).toHaveLength(0)
  })

  // 4096 é o limite da coluna; sem o corte o insert falharia em produção.
  it('corta texto gigante', async () => {
    await aplicarEvento(db(), {
      tipo: 'mensagem',
      identificador: 'inst_abc',
      numero: '556584038479',
      nome: null,
      texto: 'x'.repeat(5000),
      chave: 'K3',
      daPropriaConta: false,
    })

    expect(String(estado.upserts.at(-1)?.texto)).toHaveLength(4096)
  })
})

describe('recibo', () => {
  it('avança o status da mensagem', async () => {
    estado.mensagem = { id: 'msg-1', status: 'enviada' }
    await aplicarEvento(db(), {
      tipo: 'recibo',
      identificador: 'inst_abc',
      chave: 'K1',
      status: 'lida',
    })

    expect(estado.updates.at(-1)).toMatchObject({ tabela: 'mensagens', status: 'lida' })
  })

  it('não rebaixa', async () => {
    estado.mensagem = { id: 'msg-1', status: 'lida' }
    await aplicarEvento(db(), {
      tipo: 'recibo',
      identificador: 'inst_abc',
      chave: 'K1',
      status: 'entregue',
    })

    expect(estado.updates).toHaveLength(0)
  })

  it('ignora recibo de mensagem desconhecida', async () => {
    estado.mensagem = null
    await aplicarEvento(db(), {
      tipo: 'recibo',
      identificador: 'inst_abc',
      chave: 'K9',
      status: 'lida',
    })

    expect(estado.updates).toHaveLength(0)
  })
})

describe('conexão', () => {
  it('grava a volta sem notificar', async () => {
    estado.instancia = { id: 'inst-uuid', owner_id: 'user-1', nome: 'teste', status: 'desconectada' }
    await aplicarEvento(db(), { tipo: 'conexao', identificador: 'inst_abc', estado: 'open' })

    expect(estado.updates.at(-1)).toMatchObject({ tabela: 'instances', status: 'conectada' })
    expect(estado.notificacoes).toHaveLength(0)
  })

  // Evita um update por evento redundante que a Evolution manda de tempos em
  // tempos.
  it('não reescreve quando já estava conectada', async () => {
    await aplicarEvento(db(), { tipo: 'conexao', identificador: 'inst_abc', estado: 'open' })
    expect(estado.updates).toHaveLength(0)
  })

  it('grava a queda e notifica', async () => {
    await aplicarEvento(db(), { tipo: 'conexao', identificador: 'inst_abc', estado: 'close' })

    expect(estado.updates.at(-1)).toMatchObject({ tabela: 'instances', status: 'desconectada' })
    expect(estado.notificacoes.at(-1)).toMatchObject({ tipo: 'conexao' })
  })

  // Toda instância nasce fechada: sem esta guarda, criar conexão avisaria
  // queda antes de o QR ser lido.
  it('não avisa queda de quem não estava conectada', async () => {
    estado.instancia = { id: 'inst-uuid', owner_id: 'user-1', nome: 'teste', status: 'criada' }
    await aplicarEvento(db(), { tipo: 'conexao', identificador: 'inst_abc', estado: 'close' })

    expect(estado.notificacoes).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/whatsapp/__tests__/gravar.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/whatsapp/gravar"`

- [ ] **Step 3: Implementar**

```ts
// lib/whatsapp/gravar.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deveNotificarQueda } from '@/lib/notificacoes'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'
import { reciboAvanca, type EventoNeutro } from '@/lib/whatsapp/eventos'

/** Limite da coluna `mensagens.texto`. */
const LIMITE_TEXTO = 4096

async function instanciaPor(db: SupabaseClient, identificador: string) {
  const { data } = await db
    .from('instances')
    .select('id, owner_id, nome, status')
    .eq('evolution_name', identificador)
    .maybeSingle()

  return data as
    | { id: string; owner_id: string; nome: string; status: string }
    | null
}

/**
 * Aplica ao banco um evento já traduzido, venha de qual provedor vier.
 *
 * Saiu de dentro da rota de webhook para que os três provedores compartilhem
 * uma gravação só: o que muda entre eles é a leitura do payload, não o que
 * fazer com ele.
 */
export async function aplicarEvento(
  db: SupabaseClient,
  evento: EventoNeutro,
): Promise<void> {
  if (evento.tipo === 'mensagem') {
    const instancia = await instanciaPor(db, evento.identificador)
    if (!instancia) return

    // A do disparo já foi gravada com esta mesma chave; ignoreDuplicates
    // deixa o índice único resolver, inclusive se os dois chegarem juntos.
    const { error } = await db.from('mensagens').upsert(
      {
        owner_id: instancia.owner_id,
        instance_id: instancia.id,
        numero: evento.numero,
        nome: evento.nome,
        direcao: evento.daPropriaConta ? 'saida' : 'entrada',
        status: evento.daPropriaConta ? 'enviada' : 'recebida',
        texto: evento.texto.slice(0, LIMITE_TEXTO),
        mensagem_key: evento.chave,
      },
      { onConflict: 'mensagem_key', ignoreDuplicates: true },
    )

    // Sem isto, uma falha de gravação sumia sem deixar rastro e o sintoma era
    // apenas "a mensagem não aparece na tela".
    if (error) {
      console.error('[webhook] não gravou a mensagem:', error.code, error.message)
    }

    if (!evento.daPropriaConta) {
      await registrarNotificacao(db, String(instancia.owner_id), {
        tipo: 'mensagem',
        numero: evento.numero,
        nome: evento.nome,
        texto: evento.texto,
      })
    }
    return
  }

  if (evento.tipo === 'recibo') {
    const { data: mensagem } = await db
      .from('mensagens')
      .select('id, status')
      .eq('mensagem_key', evento.chave)
      .maybeSingle()

    if (!mensagem) return
    if (!reciboAvanca(String(mensagem.status), evento.status)) return

    await db
      .from('mensagens')
      .update({ status: evento.status })
      .eq('id', mensagem.id)
    return
  }

  const instancia = await instanciaPor(db, evento.identificador)
  if (!instancia) return

  if (evento.estado === 'open') {
    // Nada para gravar se já estava conectada: evita um update por evento
    // redundante que a Evolution manda de tempos em tempos. Reconectar é boa
    // notícia, então este caminho nunca notifica.
    if (String(instancia.status) === 'conectada') return

    await db
      .from('instances')
      .update({ status: 'conectada', atualizado_em: new Date().toISOString() })
      .eq('id', instancia.id)
    return
  }

  if (!deveNotificarQueda(String(instancia.status), evento.estado)) return

  // O banco precisa refletir a queda, senão a tela seguiria dizendo conectada
  // até alguém abrir Conexão.
  await db
    .from('instances')
    .update({ status: 'desconectada', atualizado_em: new Date().toISOString() })
    .eq('id', instancia.id)

  await registrarNotificacao(db, String(instancia.owner_id), {
    tipo: 'conexao',
    id: String(instancia.id),
    nome: String(instancia.nome),
  })
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/whatsapp/__tests__/gravar.test.ts`
Expected: PASS (11 testes)

- [ ] **Step 5: Typecheck e suíte**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 6: Commit**

```bash
git add lib/whatsapp/gravar.ts lib/whatsapp/__tests__/gravar.test.ts
git commit -m "feat(provedor): gravação a partir do evento neutro"
```

---

### Task 5: Rota de webhook por provedor

**Files:**
- Create: `app/api/webhooks/[provedor]/[segredo]/route.ts`
- Modify: `app/api/webhooks/evolution/[segredo]/route.ts` (substituir por casca fina)
- Test: `app/api/webhooks/[provedor]/__tests__/route.test.ts`
- Read first: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`

**Interfaces:**
- Consumes: `traduzirEvolution` (Task 3), `aplicarEvento` (Task 4), `ehNomeProvedor` (Task 1).
- Produces: `POST(request, { params })` na rota nova; `TRADUTOR: Record<NomeProvedor, (bruto: unknown) => EventoNeutro | null>` exportado de `lib/whatsapp/registro.ts`.

**Cuidado de produção:** a instância que já existe na Evolution tem `/api/webhooks/evolution/{segredo}` gravada dentro dela. A rota antiga vira uma casca que delega — nunca some.

- [ ] **Step 1: Ler a doc de rotas desta versão do Next**

Run: `sed -n '1,80p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`

Confirmar a assinatura de `params` (nesta versão é `Promise<...>`, como já usado na rota atual).

- [ ] **Step 2: Escrever o teste falhando**

```ts
// app/api/webhooks/[provedor]/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/[provedor]/[segredo]/route'

const estado = vi.hoisted(() => ({ aplicados: [] as unknown[] }))

vi.mock('@/lib/supabase/admin', () => ({ criarClienteAdmin: () => ({}) }))
vi.mock('@/lib/whatsapp/gravar', () => ({
  aplicarEvento: async (_db: unknown, evento: unknown) => {
    estado.aplicados.push(evento)
  },
}))

function pedido(corpo: unknown) {
  return new Request('http://localhost/api/webhooks/evolution/segredo', {
    method: 'POST',
    body: JSON.stringify(corpo),
  })
}

function params(provedor: string, segredo: string) {
  return { params: Promise.resolve({ provedor, segredo }) }
}

beforeEach(() => {
  estado.aplicados = []
  process.env.WEBHOOK_SECRET = 'segredo'
})

describe('portão', () => {
  // 404 em vez de 401: não confirma para um sondador que o caminho existe.
  it('recusa segredo errado com 404', async () => {
    const r = await POST(pedido({}), params('evolution', 'outro'))
    expect(r.status).toBe(404)
    expect(estado.aplicados).toHaveLength(0)
  })

  it('recusa provedor desconhecido com 404', async () => {
    const r = await POST(pedido({}), params('baileys', 'segredo'))
    expect(r.status).toBe(404)
  })

  it('recusa quando o segredo não está configurado', async () => {
    delete process.env.WEBHOOK_SECRET
    const r = await POST(pedido({}), params('evolution', 'segredo'))
    expect(r.status).toBe(404)
  })
})

describe('despacho', () => {
  it('traduz e aplica evento da Evolution', async () => {
    const r = await POST(
      pedido({
        event: 'messages.upsert',
        instance: 'inst_abc',
        data: {
          key: { remoteJid: '556584038479@s.whatsapp.net', fromMe: false, id: 'K1' },
          pushName: 'Matheus',
          message: { conversation: 'Oi' },
        },
      }),
      params('evolution', 'segredo'),
    )

    expect(r.status).toBe(200)
    expect(estado.aplicados.at(-1)).toMatchObject({ tipo: 'mensagem', numero: '556584038479' })
  })

  // Responder 200 rápido é obrigatório: a Evolution reenvia o que falhar.
  it('responde 200 a evento que não interessa', async () => {
    const r = await POST(
      pedido({ event: 'contacts.upsert', instance: 'inst_abc', data: {} }),
      params('evolution', 'segredo'),
    )

    expect(r.status).toBe(200)
    expect(estado.aplicados).toHaveLength(0)
  })

  it('responde 200 a JSON inválido em vez de erro', async () => {
    const cru = new Request('http://localhost/x', { method: 'POST', body: 'não é json' })
    const r = await POST(cru, params('evolution', 'segredo'))
    expect(r.status).toBe(200)
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run 'app/api/webhooks/[provedor]/__tests__/route.test.ts'`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Criar o registro de tradutores**

```ts
// lib/whatsapp/registro.ts
import type { EventoNeutro } from '@/lib/whatsapp/eventos'
import type { NomeProvedor } from '@/lib/whatsapp/provedores'
import { traduzirEvolution } from '@/lib/whatsapp/evolution/traduzir'

/**
 * Tradutor de webhook por provedor.
 *
 * Evolution Go e WuZAPI entram aqui nas Tasks 7 e 8; até lá apontam para o
 * tradutor da Evolution, que devolve null para formato que não reconhece —
 * nunca lança.
 */
export const TRADUTOR: Record<
  NomeProvedor,
  (bruto: unknown) => EventoNeutro | null
> = {
  evolution: traduzirEvolution,
  'evolution-go': traduzirEvolution,
  wuzapi: traduzirEvolution,
}
```

- [ ] **Step 5: Criar a rota nova**

```ts
// app/api/webhooks/[provedor]/[segredo]/route.ts
import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { aplicarEvento } from '@/lib/whatsapp/gravar'
import { ehNomeProvedor } from '@/lib/whatsapp/provedores'
import { TRADUTOR } from '@/lib/whatsapp/registro'

export const dynamic = 'force-dynamic'

/**
 * Receptor único de webhook, com o provedor no caminho.
 *
 * O que muda entre provedores é só a leitura do payload; a partir do evento
 * neutro, a gravação é a mesma. Responder 200 rápido é obrigatório: a
 * Evolution reenvia em laço o que falhar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provedor: string; segredo: string }> },
) {
  const { provedor, segredo } = await params
  const esperado = process.env.WEBHOOK_SECRET

  // Segredo ausente na configuração nunca deve liberar a rota. 404 em vez de
  // 401: não confirma para um sondador que o caminho existe.
  if (!esperado || segredo !== esperado || !ehNomeProvedor(provedor)) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 })
  }

  let bruto: unknown = null
  try {
    bruto = await request.json()
  } catch {
    // 200 mesmo assim: erro faria o provedor reenviar para sempre.
    return NextResponse.json({ ok: true })
  }

  try {
    const evento = TRADUTOR[provedor](bruto)
    if (evento) await aplicarEvento(criarClienteAdmin(), evento)
  } catch (erro) {
    console.error('[webhook] falha ao processar evento:', erro)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Rodar e confirmar verde**

Run: `npx vitest run 'app/api/webhooks/[provedor]/__tests__/route.test.ts'`
Expected: PASS (7 testes)

- [ ] **Step 7: Reduzir a rota antiga a uma casca**

Substituir **todo** o conteúdo de `app/api/webhooks/evolution/[segredo]/route.ts` por:

```ts
import { POST as receber } from '@/app/api/webhooks/[provedor]/[segredo]/route'

export const dynamic = 'force-dynamic'

/**
 * Caminho legado, mantido de propósito.
 *
 * As instâncias já criadas têm esta URL gravada dentro da Evolution; apagar a
 * rota derrubaria a entrega delas até alguém reconfigurar o webhook uma a
 * uma. Novas conexões nascem apontando para /api/webhooks/{provedor}/...
 */
export function POST(
  request: Request,
  { params }: { params: Promise<{ segredo: string }> },
) {
  return receber(request, {
    params: params.then(({ segredo }) => ({ provedor: 'evolution', segredo })),
  })
}
```

- [ ] **Step 8: Apagar o teste antigo da rota e rodar tudo**

O arquivo `app/api/webhooks/evolution/[segredo]/__tests__/route.test.ts` testava a lógica que agora vive em `traduzir.ts` e `gravar.ts`, já coberta pelas Tasks 3 e 4.

```bash
git rm 'app/api/webhooks/evolution/[segredo]/__tests__/route.test.ts'
```

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 9: Verificar contra o servidor real**

```bash
set -a; . ./.env; set +a
npm run dev &
sleep 25
# caminho legado
curl -s -X POST "http://localhost:3000/api/webhooks/evolution/$WEBHOOK_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"instance":"inst_13fc9fa0","event":"messages.upsert","data":{"key":{"remoteJid":"556584038479@s.whatsapp.net","fromMe":false,"id":"PLANO_T5_A"},"pushName":"Sonda","message":{"conversation":"legado"}}}'
# caminho novo
curl -s -X POST "http://localhost:3000/api/webhooks/evolution/$WEBHOOK_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"instance":"inst_13fc9fa0","event":"messages.upsert","data":{"key":{"remoteJid":"556584038479@s.whatsapp.net","fromMe":false,"id":"PLANO_T5_B"},"pushName":"Sonda","message":{"conversation":"novo"}}}'
```

Expected: `{"ok":true}` nas duas. Conferir que **as duas** linhas entraram e depois **apagar as duas**:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/mensagens?select=mensagem_key,texto&mensagem_key=like.PLANO_T5*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/mensagens?mensagem_key=like.PLANO_T5*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Apagar também a notificação `mensagem:556584038479` criada pela sonda, se o dono dela for o da instância de teste.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(webhook): rota única por provedor, com o caminho legado preservado"
```

---

### Task 6: A interface de saída e o registro de provedores

**Files:**
- Create: `lib/whatsapp/provedor.ts`
- Create: `lib/whatsapp/evolution/provedor.ts`
- Modify: `lib/whatsapp/registro.ts`
- Modify: `app/(app)/conexao/actions.ts`
- Modify: `lib/disparos/processador.ts`
- Test: `lib/whatsapp/evolution/__tests__/provedor.test.ts`

**Interfaces:**
- Consumes: tudo de `lib/evolution/` (client, endpoints, instances, errors).
- Produces:

```ts
export type Credenciais = { identificador: string; token: string | null }
export type ResultadoCriacao = { identificador: string; token: string | null; qrBase64: string | null }
export type ResultadoConexao = { qrBase64: string | null; pairingCode: string | null }

export interface ProvedorWhatsApp {
  readonly nome: NomeProvedor
  criar(p: { urlWebhook: string; timeoutMs?: number }): Promise<ResultadoCriacao>
  conectar(c: Credenciais, o?: { timeoutMs?: number }): Promise<ResultadoConexao>
  estado(c: Credenciais): Promise<EstadoConexao>
  desconectar(c: Credenciais): Promise<void>
  remover(c: Credenciais, o?: { timeoutMs?: number }): Promise<void>
  definirWebhook(c: Credenciais, url: string, o?: { timeoutMs?: number }): Promise<void>
  enviarTexto(c: Credenciais, numero: string, texto: string): Promise<{ chave: string | null }>
}
```
  e `provedorPara(nome: NomeProvedor): ProvedorWhatsApp` em `registro.ts`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/whatsapp/evolution/__tests__/provedor.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rede = vi.hoisted(() => ({
  chamadas: [] as { caminho: string; opcoes: Record<string, unknown> }[],
  resposta: {} as unknown,
}))

vi.mock('@/lib/evolution/client', () => ({
  TIMEOUT_ACORDAR_MS: 100_000,
  chamar: async (caminho: string, opcoes: Record<string, unknown> = {}) => {
    rede.chamadas.push({ caminho, opcoes })
    return rede.resposta
  },
}))

// `vi.mock` é içado acima deste import, então o provedor já nasce falando com
// o cliente falso.
import { evolutionV2 } from '@/lib/whatsapp/evolution/provedor'

beforeEach(() => {
  rede.chamadas = []
  rede.resposta = {}
})

describe('evolutionV2', () => {
  it('se identifica', () => {
    expect(evolutionV2.nome).toBe('evolution')
  })

  it('cria instância pedindo QR e devolve o base64', async () => {
    rede.resposta = {
      instance: { instanceName: 'inst_x' },
      qrcode: { base64: 'data:image/png;base64,AAA' },
    }
    const r = await evolutionV2.criar({ urlWebhook: 'https://app/hook' })

    expect(rede.chamadas.at(-1)?.caminho).toBe('/instance/create')
    expect(r.identificador).toBe('inst_x')
    expect(r.qrBase64).toBe('data:image/png;base64,AAA')
    // A Evolution usa apikey global: não há token por instância.
    expect(r.token).toBeNull()
  })

  it('lê o estado da instância', async () => {
    rede.resposta = { instance: { instanceName: 'inst_x', state: 'open' } }
    const estado = await evolutionV2.estado({ identificador: 'inst_x', token: null })

    expect(estado).toBe('open')
    expect(rede.chamadas.at(-1)?.caminho).toBe('/instance/connectionState/inst_x')
  })

  it('envia texto e devolve a chave da mensagem', async () => {
    rede.resposta = { key: { id: 'K9' } }
    const r = await evolutionV2.enviarTexto(
      { identificador: 'inst_x', token: null },
      '5565984038479',
      'Olá',
    )

    expect(rede.chamadas.at(-1)?.caminho).toBe('/message/sendText/inst_x')
    expect(r.chave).toBe('K9')
  })

  it('remove pelo caminho de delete', async () => {
    await evolutionV2.remover({ identificador: 'inst_x', token: null })
    expect(rede.chamadas.at(-1)?.caminho).toBe('/instance/delete/inst_x')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/whatsapp/evolution/__tests__/provedor.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Escrever a interface**

```ts
// lib/whatsapp/provedor.ts
import type { EstadoConexao } from '@/lib/whatsapp/eventos'
import type { NomeProvedor } from '@/lib/whatsapp/provedores'

/**
 * Como o app endereça uma instância no provedor.
 *
 * `token` é nulo na Evolution, que usa uma apikey global; a WuZAPI dá um
 * token por usuário e é ele que vai no header.
 */
export type Credenciais = { identificador: string; token: string | null }

export type ResultadoCriacao = {
  identificador: string
  token: string | null
  qrBase64: string | null
}

export type ResultadoConexao = {
  qrBase64: string | null
  pairingCode: string | null
}

/**
 * O que o app precisa de uma API de WhatsApp.
 *
 * Deliberadamente pequeno: só o que as telas e o disparo usam hoje. Grupos,
 * enquetes e presença ficam de fora até existir tela que peça.
 */
export interface ProvedorWhatsApp {
  readonly nome: NomeProvedor
  criar(p: { urlWebhook: string; timeoutMs?: number }): Promise<ResultadoCriacao>
  conectar(c: Credenciais, o?: { timeoutMs?: number }): Promise<ResultadoConexao>
  estado(c: Credenciais): Promise<EstadoConexao>
  desconectar(c: Credenciais): Promise<void>
  remover(c: Credenciais, o?: { timeoutMs?: number }): Promise<void>
  definirWebhook(c: Credenciais, url: string, o?: { timeoutMs?: number }): Promise<void>
  enviarTexto(
    c: Credenciais,
    numero: string,
    texto: string,
  ): Promise<{ chave: string | null }>
}
```

- [ ] **Step 4: Implementar a Evolution v2 sobre o que já existe**

```ts
// lib/whatsapp/evolution/provedor.ts
import { chamar } from '@/lib/evolution/client'
import { endpoints } from '@/lib/evolution/endpoints'
import { EvolutionError } from '@/lib/evolution/errors'
import {
  conectarInstancia,
  criarInstancia,
  definirWebhook,
  estadoInstancia,
  gerarNomeInstancia,
  removerInstancia,
} from '@/lib/evolution/instances'
import type { ProvedorWhatsApp } from '@/lib/whatsapp/provedor'

/**
 * Evolution API v2 — o provedor em produção.
 *
 * Casca fina sobre `lib/evolution/`, que já fazia tudo isto: o valor da task
 * é passar a existir por trás de uma interface, para Evolution Go e WuZAPI
 * poderem ocupar o mesmo lugar.
 */
export const evolutionV2: ProvedorWhatsApp = {
  nome: 'evolution',

  async criar({ urlWebhook, timeoutMs }) {
    const nome = gerarNomeInstancia()
    const resposta = await criarInstancia(nome, urlWebhook, { timeoutMs })

    return {
      identificador: resposta.instance?.instanceName ?? nome,
      // apikey global: nada por instância para guardar.
      token: null,
      qrBase64: resposta.qrcode?.base64 ?? null,
    }
  },

  async conectar({ identificador }, opcoes) {
    const r = await conectarInstancia(identificador, opcoes)
    return { qrBase64: r.base64 ?? null, pairingCode: r.pairingCode ?? null }
  },

  estado({ identificador }) {
    return estadoInstancia(identificador)
  },

  async desconectar({ identificador }) {
    await chamar(endpoints.instancia.logout(identificador), { metodo: 'DELETE' })
  },

  async remover({ identificador }, opcoes) {
    await removerInstancia(identificador, opcoes)
  },

  async definirWebhook({ identificador }, url, opcoes) {
    await definirWebhook(identificador, url, opcoes)
  },

  async enviarTexto({ identificador }, numero, texto) {
    const r = await chamar<{ key?: { id?: string } }>(
      endpoints.mensagem.texto(identificador),
      { metodo: 'POST', corpo: { number: numero, text: texto } },
    )
    return { chave: r.key?.id ? String(r.key.id) : null }
  },
}

// Reexporta para quem trata erro de provedor sem saber qual é.
export { EvolutionError }
```

> **Atenção ao executar:** o corpo de `enviarTexto` (`{ number, text }`) deve bater exatamente com o que `lib/disparos/processador.ts:75-80` envia hoje. Abrir o arquivo e copiar o formato real antes de rodar; se divergir, o formato do processador é o que vale — ele está confirmado contra a 2.3.7.

- [ ] **Step 5: Rodar e confirmar verde**

Run: `npx vitest run lib/whatsapp/evolution/__tests__/provedor.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 6: Acrescentar o resolvedor ao registro**

Acrescentar em `lib/whatsapp/registro.ts`:

```ts
import { evolutionV2 } from '@/lib/whatsapp/evolution/provedor'
import type { ProvedorWhatsApp } from '@/lib/whatsapp/provedor'

const IMPLEMENTACAO: Record<NomeProvedor, ProvedorWhatsApp> = {
  evolution: evolutionV2,
  // Substituídos nas Tasks 7 e 8; até lá, uma conexão criada com estes nomes
  // falaria com a Evolution, então a UI da Task 9 só os oferece depois.
  'evolution-go': evolutionV2,
  wuzapi: evolutionV2,
}

export function provedorPara(nome: NomeProvedor): ProvedorWhatsApp {
  return IMPLEMENTACAO[nome]
}
```

- [ ] **Step 7: Apontar os dois pontos de chamada para o registro**

Em `app/(app)/conexao/actions.ts` e `lib/disparos/processador.ts`, trocar os imports diretos de `@/lib/evolution/*` por `provedorPara(...)`, lendo a coluna `provedor` da linha de `instances` (adicionar `provedor` ao `select` de cada consulta que já busca `evolution_name`).

Padrão a seguir em cada ponto:

```ts
const provedor = provedorPara(
  ehNomeProvedor(String(conexao.provedor)) ? String(conexao.provedor) : PROVEDOR_PADRAO,
)
const cred = {
  identificador: String(conexao.evolution_name),
  token: conexao.token ? String(conexao.token) : null,
}
await provedor.remover(cred, { timeoutMs: TIMEOUT_ACORDAR_MS })
```

- [ ] **Step 8: Typecheck, suíte e verificação real**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

Depois, com `npm run dev`, abrir `/conexao` e confirmar que o estado da conexão existente ainda é lido (a tela não pode regredir).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(provedor): interface de saída, com a Evolution v2 como primeira implementação"
```

---

### Task 7: Implementação Evolution Go

**Files:**
- Create: `lib/whatsapp/evolution-go/cliente.ts` (exporta `chamarGo`, lendo `EVOLUTION_GO_API_URL` / `EVOLUTION_GO_API_KEY`)
- Create: `lib/whatsapp/evolution-go/endpoints.ts`
- Create: `lib/whatsapp/evolution-go/provedor.ts`
- Create: `lib/whatsapp/evolution-go/traduzir.ts`
- Create: `docs/endpoints-evolution-go-confirmados.md`
- Modify: `lib/whatsapp/registro.ts`
- Modify: `.env.example`
- Test: `lib/whatsapp/evolution-go/__tests__/provedor.test.ts`

**Interfaces:**
- Consumes: `ProvedorWhatsApp`, `Credenciais` (Task 6); `EventoNeutro` (Task 2).
- Produces: `evolutionGo: ProvedorWhatsApp`, `traduzirEvolutionGo(bruto: unknown): EventoNeutro | null`, `chamarGo<T>(caminho: string, opcoes?: OpcoesChamada): Promise<T>`.

**Pré-requisito bloqueante — fazer antes de escrever código:**

Só dois caminhos da Evolution Go estão confirmados por documentação: `GET /instance/all` (contra `/instance/fetchInstances` da v2) e o QR em endpoint próprio. Os outros onze **não foram verificados**. Subir uma instância local e confirmar cada um contra o Swagger dela:

```bash
docker run -d --name evo-go -p 8081:8080 evoapicloud/evolution-go:latest
# abrir http://localhost:8081/swagger/index.html e anotar os caminhos reais
```

Registrar o resultado em `docs/endpoints-evolution-go-confirmados.md`, no mesmo formato de `docs/endpoints-evolution-confirmados.md`. **Não inventar caminho por analogia com a v2** — foi exatamente essa suposição que a análise derrubou.

Contar também com o gate de licença: a partir da 2.4.0 os endpoints devolvem `503 LICENSE_REQUIRED` até a instância ser ativada contra o servidor da Evolution Foundation. Se o 503 aparecer, ativar antes de seguir; se a ativação não for aceitável, **parar aqui e reavaliar** — a Task 8 (WuZAPI) não depende desta e pode ser feita sozinha.

- [ ] **Step 1: Confirmar os endpoints e escrever o documento**

Criar `docs/endpoints-evolution-go-confirmados.md` com os 13 caminhos verificados no Swagger, cada um com método, corpo e resposta observada.

- [ ] **Step 2: Escrever o teste falhando**

```ts
// lib/whatsapp/evolution-go/__tests__/provedor.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ⚠️ Preencher com os caminhos ANOTADOS NO STEP 1, lidos do Swagger da
// instância local. Só o primeiro está confirmado por documentação; os demais
// são o que a v2 usa e servem apenas de lembrete do que procurar. Se algum
// divergir, o valor real do Swagger é que vale.
const CAMINHO = {
  listar: '/instance/all', // confirmado
  criar: '/instance/create', // CONFERIR
  estado: (n: string) => `/instance/connectionState/${n}`, // CONFERIR
  qr: (n: string) => `/instance/qr/${n}`, // CONFERIR — endpoint próprio na Go
  deletar: (n: string) => `/instance/delete/${n}`, // CONFERIR
  enviarTexto: (n: string) => `/message/sendText/${n}`, // CONFERIR
}

const rede = vi.hoisted(() => ({
  chamadas: [] as { caminho: string; opcoes: Record<string, unknown> }[],
  resposta: {} as unknown,
}))

vi.mock('@/lib/whatsapp/evolution-go/cliente', () => ({
  chamarGo: async (caminho: string, opcoes: Record<string, unknown> = {}) => {
    rede.chamadas.push({ caminho, opcoes })
    return rede.resposta
  },
}))

import { evolutionGo } from '@/lib/whatsapp/evolution-go/provedor'

beforeEach(() => {
  rede.chamadas = []
  rede.resposta = {}
})

describe('evolutionGo', () => {
  it('se identifica', () => {
    expect(evolutionGo.nome).toBe('evolution-go')
  })

  it('cria instância e devolve o identificador', async () => {
    rede.resposta = { instance: { instanceName: 'inst_go' } }
    const r = await evolutionGo.criar({ urlWebhook: 'https://app/hook' })

    expect(rede.chamadas.at(-1)?.caminho).toBe(CAMINHO.criar)
    expect(r.identificador).toBe('inst_go')
    // Como a v2, usa apikey global — nada por instância.
    expect(r.token).toBeNull()
  })

  it('lê o estado da instância', async () => {
    rede.resposta = { instance: { instanceName: 'inst_go', state: 'open' } }
    const estado = await evolutionGo.estado({ identificador: 'inst_go', token: null })

    expect(estado).toBe('open')
    expect(rede.chamadas.at(-1)?.caminho).toBe(CAMINHO.estado('inst_go'))
  })

  // A diferença estrutural confirmada em relação à v2: lá o QR volta dentro
  // de /instance/connect, aqui tem endpoint próprio.
  it('busca o QR no endpoint dedicado', async () => {
    rede.resposta = { base64: 'data:image/png;base64,AAA' }
    const r = await evolutionGo.conectar({ identificador: 'inst_go', token: null })

    expect(rede.chamadas.at(-1)?.caminho).toBe(CAMINHO.qr('inst_go'))
    expect(r.qrBase64).toBe('data:image/png;base64,AAA')
  })

  it('envia texto e devolve a chave da mensagem', async () => {
    rede.resposta = { key: { id: 'K9' } }
    const r = await evolutionGo.enviarTexto(
      { identificador: 'inst_go', token: null },
      '5565984038479',
      'Olá',
    )

    expect(rede.chamadas.at(-1)?.caminho).toBe(CAMINHO.enviarTexto('inst_go'))
    expect(r.chave).toBe('K9')
  })

  it('remove pelo caminho de exclusão', async () => {
    await evolutionGo.remover({ identificador: 'inst_go', token: null })
    expect(rede.chamadas.at(-1)?.caminho).toBe(CAMINHO.deletar('inst_go'))
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run lib/whatsapp/evolution-go/__tests__/provedor.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar endpoints e provedor**

Espelhar `lib/evolution/endpoints.ts` e `lib/whatsapp/evolution/provedor.ts`, com os caminhos do Step 1 e um cliente próprio que leia `EVOLUTION_GO_API_URL` / `EVOLUTION_GO_API_KEY` (mesmo header `apikey`). Acrescentar as duas variáveis a `.env.example`.

- [ ] **Step 5: Implementar o tradutor**

Se o formato de webhook for idêntico ao da v2 (verificar no Step 1 disparando uma mensagem real para a instância local e observando o corpo recebido), `traduzirEvolutionGo` pode reexportar `traduzirEvolution`, com um comentário dizendo que a igualdade foi verificada e em que data. Se divergir, escrever o tradutor próprio com a mesma bateria de testes da Task 3.

- [ ] **Step 6: Registrar**

Em `lib/whatsapp/registro.ts`, trocar `'evolution-go': evolutionV2` por `evolutionGo` nos dois mapas (`TRADUTOR` e `IMPLEMENTACAO`).

- [ ] **Step 7: Typecheck e suíte**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(provedor): implementação Evolution Go"
```

---

### Task 8: Implementação WuZAPI

**Files:**
- Create: `lib/whatsapp/wuzapi/cliente.ts`
- Create: `lib/whatsapp/wuzapi/provedor.ts`
- Create: `lib/whatsapp/wuzapi/traduzir.ts`
- Modify: `lib/whatsapp/registro.ts`
- Test: `lib/whatsapp/wuzapi/__tests__/provedor.test.ts`, `lib/whatsapp/wuzapi/__tests__/traduzir.test.ts`

**Interfaces:**
- Consumes: `ProvedorWhatsApp`, `Credenciais` (Task 6); `EventoNeutro` (Task 2).
- Produces: `wuzapi: ProvedorWhatsApp`, `traduzirWuzapi(bruto: unknown): EventoNeutro | null`.

**Diferenças de modelo que esta task tem de absorver:**

1. **Autenticação por instância.** Não há apikey global: cada número é um *usuário* com token próprio, criado por endpoint de admin com `WUZAPI_ADMIN_TOKEN`. Por isso `criar()` devolve `token` preenchido — e por isso a coluna `instances.token` existe.
2. **Nomes de evento diferentes.** Ela emite `Message`, `ReadReceipt`, `Presence`, `HistorySync`, `ChatPresence`, não `MESSAGES_UPSERT`.
3. **Assinatura HMAC-SHA256** opcional no header `x-hmac-signature`.

- [ ] **Step 1: Subir uma instância e confirmar os formatos**

```bash
docker run -d --name wuzapi -p 8080:8080 \
  -e WUZAPI_ADMIN_TOKEN=troque-me asternic/wuzapi:latest
```

Criar um usuário pelo endpoint de admin, parear um número de teste, mandar uma mensagem para ele e **capturar o corpo do webhook recebido**. Registrar em `docs/endpoints-wuzapi-confirmados.md`: caminhos, headers, e um exemplo real de payload de cada evento que nos interessa (mensagem, recibo, conexão).

- [ ] **Step 2: Escrever o teste do tradutor, falhando**

Usar os payloads **reais capturados no Step 1** como entrada — não payload inventado. Cobrir os mesmos casos da Task 3: texto simples, mídia sem legenda, mensagem própria, grupo descartado, recibo de entrega, recibo de leitura, mudança de conexão, e lixo devolvendo `null`.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run lib/whatsapp/wuzapi/__tests__/traduzir.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar o tradutor**

Mesma forma de `traduzirEvolution`: função pura, `EventoNeutro | null`, nunca lança. Reaproveitar `numeroDoContato` de `@/lib/evolution/jid` — JID é protocolo do WhatsApp e vale igual aqui.

- [ ] **Step 5: Rodar e confirmar verde**

Run: `npx vitest run lib/whatsapp/wuzapi/__tests__/traduzir.test.ts`
Expected: PASS

- [ ] **Step 6: Escrever o teste do provedor, falhando**

Cobrir explicitamente o que difere da Evolution: `criar()` devolve `token` **não nulo**, e as demais chamadas mandam esse token no header em vez da apikey global.

- [ ] **Step 7: Implementar cliente e provedor**

`cliente.ts` lê `WUZAPI_API_URL` e `WUZAPI_ADMIN_TOKEN` (acrescentar a `.env.example`) e aceita um token por chamada. `provedor.ts` implementa `ProvedorWhatsApp` sobre ele.

- [ ] **Step 8: Registrar**

Em `lib/whatsapp/registro.ts`, trocar `wuzapi: evolutionV2` por `wuzapi` e `wuzapi: traduzirEvolution` por `traduzirWuzapi`.

- [ ] **Step 9: Typecheck e suíte**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(provedor): implementação WuZAPI"
```

---

### Task 9: Escolher o provedor ao criar a conexão

**Files:**
- Modify: `app/(app)/conexao/actions.ts` (`criarConexao` recebe o provedor)
- Modify: `app/(app)/conexao/painel-conexao.tsx` (seletor)
- Modify: `lib/consultas/conexao.ts` (devolver `provedor`)
- Test: `app/(app)/conexao/__tests__/painel-conexao.test.tsx`

**Interfaces:**
- Consumes: `NOMES_PROVEDOR`, `ehNomeProvedor`, `PROVEDOR_PADRAO` (Task 1); `provedorPara` (Task 6).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Escrever o teste falhando**

```tsx
// acrescentar a app/(app)/conexao/__tests__/painel-conexao.test.tsx
describe('escolha de provedor', () => {
  it('oferece os três provedores', async () => {
    render(<PainelConexao conexoes={[]} />)
    await userEvent.click(await screen.findByRole('button', { name: /Nova conexão/ }))

    const seletor = await screen.findByLabelText(/Provedor/)
    expect(seletor).toHaveValue('evolution')
    expect(
      within(seletor).getByRole('option', { name: /WuZAPI/ }),
    ).toBeInTheDocument()
  })

  // A conexão existente não muda de provedor: a sessão do WhatsApp vive
  // dentro do provedor onde foi pareada.
  it('não oferece troca de provedor em conexão já criada', async () => {
    render(
      <PainelConexao
        conexoes={[
          { id: 'c1', nome: 'teste', status: 'conectada', numero: null, provedor: 'evolution' },
        ]}
      />,
    )
    expect(screen.queryByLabelText(/Provedor/)).not.toBeInTheDocument()
  })
})
```

> Ajustar os nomes de props e o texto do gatilho ao que o `painel-conexao.tsx` real usa — abrir o arquivo antes de escrever.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/conexao/__tests__/painel-conexao.test.tsx'`
Expected: FAIL — seletor não existe.

- [ ] **Step 3: Implementar o seletor e a passagem até a action**

`criarConexao` passa a receber o nome do provedor, validá-lo com `ehNomeProvedor` (recusando com erro em vez de cair no padrão — server action é chamável por HTTP direto), gravar em `instances.provedor`, e montar a URL de webhook **com o provedor no caminho**: `/api/webhooks/{provedor}/{segredo}`.

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/conexao/__tests__/painel-conexao.test.tsx'`
Expected: PASS

- [ ] **Step 5: Typecheck, suíte e build**

Run: `npx tsc --noEmit && npm run test:run && npm run build`
Expected: os três limpos.

> `next build` reescreve `next-env.d.ts` para os tipos de produção. Restaurar com `git checkout -- next-env.d.ts` antes de commitar — rodar `next dev` inverte de volta, e o arquivo alterna conforme o último comando.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(conexao): escolher o provedor ao criar a conexão"
```

---

## Verificação final

- [ ] `npm run test:run` — suíte inteira verde
- [ ] `npx tsc --noEmit` — limpo
- [ ] `npm run build` — completo
- [ ] A conexão existente em produção continua funcionando, com o webhook legado entregando
- [ ] Nenhuma linha de sondagem sobrou em `mensagens` ou `notificacoes`
- [ ] `git status` limpo (`next-env.d.ts` restaurado)

## O que este plano deliberadamente NÃO faz

- **Não migra a conexão existente** para outro provedor. A sessão do WhatsApp vive dentro do provedor onde foi pareada; trocar exige reler o QR. Fazer isso é decisão de operação, não de código.
- **Não renomeia `evolution_name`.** Ver Decisão 1.
- **Não resolve a hibernação do Render**, que é o custo que hoje se sente de verdade (`TIMEOUT_ACORDAR_MS = 100_000`). Isso é plano de hospedagem, não código — e nenhum provedor em Go conserta um contêiner suspenso.
- **Não promete ganho de desempenho perceptível com uma conexão.** O ganho de `whatsmeow` sobre Baileys é sessão estável em uptime longo e RAM previsível por conexão; ele aparece com muitas conexões e semanas de uptime, não em teste manual.
