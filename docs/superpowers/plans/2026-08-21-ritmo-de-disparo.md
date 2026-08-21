# Ritmo de Disparo e Redução de Risco — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o ritmo fixo do disparo por um comportamento variável, com janela de horário, teto diário e aquecimento de número novo.

**Architecture:** Hoje `lib/disparos/processador.ts` envia com `PAUSA_ENTRE_ENVIOS_MS = 1200` constante e `TAMANHO_LOTE = 10` fixo — cadência perfeitamente regular, que é a assinatura de automação mais fácil de detectar. O plano extrai as decisões de ritmo para um módulo puro e testável (`lib/disparos/ritmo.ts`), configurável por conexão, e o processador passa a consultá-lo. Nenhuma mudança no caminho de envio em si.

**Tech Stack:** Next.js 16.3, TypeScript, Supabase (Postgres + RLS), Vitest.

**Spec:** `implementation.txt`, item 1 — "variar horários, intervalos e padrões de disparo, sempre respeitando as regras da Meta, para evitar comportamento automatizado excessivamente repetitivo".

## Aviso que precisa constar

**Este plano reduz detecção, não produz conformidade.** Baileys e whatsmeow são clientes não-oficiais do WhatsApp; usá-los já contraria os termos da Meta, e nenhum ritmo de envio muda isso. A frase da spec pede as duas coisas ao mesmo tempo, e elas não coexistem nesta arquitetura.

Conformidade real com a Meta exige a **WhatsApp Business Cloud API oficial**: templates submetidos a aprovação, cobrança por conversa, e nenhum QR code. É outro produto e outra economia. A decisão de qual dos dois caminhos seguir é do dono do produto; este plano melhora o caminho atual sem fingir que ele é o outro.

## Global Constraints

- **Comentários em português**, explicando *por que*. Nunca comentar o óbvio.
- **TDD**: teste falhando antes da implementação; suíte verde a cada task.
- **`npx tsc --noEmit` limpo** ao fim de cada task.
- **Aleatoriedade sempre injetada**, nunca `Math.random()` chamado dentro da lógica — senão o comportamento não é testável. Toda função que sorteia recebe a fonte como parâmetro com padrão.
- **Numeração de migration:** ocupa a **0016**, assumindo que `2026-08-21-chat-e-esteira.md` já usou 0014/0015. Conferir `ls supabase/migrations/` antes e ajustar.
- Commits frequentes, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Decisões já tomadas (não reabrir)

1. **Configuração por conexão, não global.** Números diferentes têm idades e reputações diferentes; um número novo e um de dois anos não podem compartilhar teto.
2. **O teto é contado por dia civil no fuso de São Paulo**, não por 24h móveis. "Quantas mandei hoje" é a pergunta que o usuário faz.
3. **Fora da janela o lote não falha: ele adia.** Marcar como falha gastaria a tentativa e sujaria o relatório do disparo com erro que não é erro.

---

### Task 1: Domínio do ritmo

**Files:**
- Create: `lib/disparos/ritmo.ts`
- Test: `lib/disparos/__tests__/ritmo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
```ts
export type Janela = { inicioHora: number; fimHora: number }
export function pausaSorteada(minMs: number, maxMs: number, sorteio?: () => number): number
export function dentroDaJanela(agora: Date, janela: Janela): boolean
export function tetoDoDia(tetoConfigurado: number, diasDeUso: number): number
export function podeEnviar(p: { enviadosHoje: number; teto: number }): boolean
export function tamanhoDoLote(base: number, sorteio?: () => number): number
export const PAUSA_MIN_MS: number
export const PAUSA_MAX_MS: number
export const DIAS_AQUECIMENTO: number
```

- [ ] **Step 1: Escrever o teste falhando**

```ts
// lib/disparos/__tests__/ritmo.test.ts
import { describe, expect, it } from 'vitest'
import {
  DIAS_AQUECIMENTO,
  dentroDaJanela,
  PAUSA_MAX_MS,
  PAUSA_MIN_MS,
  pausaSorteada,
  podeEnviar,
  tamanhoDoLote,
  tetoDoDia,
} from '@/lib/disparos/ritmo'

describe('pausaSorteada', () => {
  // O 1200ms fixo de antes é o padrão que se quer quebrar: cadência perfeita
  // é a assinatura de robô mais fácil de reconhecer.
  it('devolve o mínimo quando o sorteio dá 0', () => {
    expect(pausaSorteada(3000, 15000, () => 0)).toBe(3000)
  })

  it('devolve perto do máximo quando o sorteio dá quase 1', () => {
    expect(pausaSorteada(3000, 15000, () => 0.999)).toBeGreaterThan(14900)
  })

  it('fica dentro da faixa em qualquer sorteio', () => {
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const p = pausaSorteada(3000, 15000, () => s)
      expect(p).toBeGreaterThanOrEqual(3000)
      expect(p).toBeLessThanOrEqual(15000)
    }
  })

  // Faixa invertida por engano de configuração não pode virar pausa negativa,
  // que faria o disparo virar rajada — exatamente o oposto do objetivo.
  it('não devolve valor negativo com faixa invertida', () => {
    expect(pausaSorteada(15000, 3000, () => 0.5)).toBeGreaterThanOrEqual(0)
  })

  it('o padrão de fábrica é mais lento que o 1200ms antigo', () => {
    expect(PAUSA_MIN_MS).toBeGreaterThan(1200)
    expect(PAUSA_MAX_MS).toBeGreaterThan(PAUSA_MIN_MS)
  })
})

describe('dentroDaJanela', () => {
  const comercial = { inicioHora: 8, fimHora: 20 }

  // Mensagem comercial às 3 da manhã é o comportamento que mais gera
  // denúncia — e denúncia é o que bane, mais que volume.
  it('aceita horário dentro da janela', () => {
    expect(dentroDaJanela(new Date('2026-08-21T12:00:00-03:00'), comercial)).toBe(true)
  })

  it('recusa antes da abertura', () => {
    expect(dentroDaJanela(new Date('2026-08-21T07:59:00-03:00'), comercial)).toBe(false)
  })

  it('recusa depois do fechamento', () => {
    expect(dentroDaJanela(new Date('2026-08-21T20:00:00-03:00'), comercial)).toBe(false)
  })

  it('inclui a hora de abertura', () => {
    expect(dentroDaJanela(new Date('2026-08-21T08:00:00-03:00'), comercial)).toBe(true)
  })

  // Janela 0–24 é a saída de quem não quer restrição nenhuma.
  it('janela cheia aceita qualquer hora', () => {
    expect(
      dentroDaJanela(new Date('2026-08-21T03:00:00-03:00'), { inicioHora: 0, fimHora: 24 }),
    ).toBe(true)
  })
})

describe('tetoDoDia', () => {
  // Número novo que dispara 500 no primeiro dia é o caso clássico de ban
  // imediato. A rampa sobe até o teto configurado.
  it('começa baixo no primeiro dia', () => {
    expect(tetoDoDia(500, 0)).toBeLessThan(100)
  })

  it('cresce com os dias de uso', () => {
    expect(tetoDoDia(500, 3)).toBeGreaterThan(tetoDoDia(500, 0))
  })

  it('chega ao teto configurado depois do aquecimento', () => {
    expect(tetoDoDia(500, DIAS_AQUECIMENTO)).toBe(500)
  })

  it('não passa do teto configurado', () => {
    expect(tetoDoDia(500, 999)).toBe(500)
  })

  // Teto pequeno não pode virar rampa maior que ele próprio.
  it('respeita teto menor que a rampa', () => {
    expect(tetoDoDia(10, 0)).toBeLessThanOrEqual(10)
  })
})

describe('podeEnviar', () => {
  it('deixa enviar abaixo do teto', () => {
    expect(podeEnviar({ enviadosHoje: 40, teto: 50 })).toBe(true)
  })

  it('barra no teto', () => {
    expect(podeEnviar({ enviadosHoje: 50, teto: 50 })).toBe(false)
  })

  it('barra acima do teto', () => {
    expect(podeEnviar({ enviadosHoje: 80, teto: 50 })).toBe(false)
  })
})

describe('tamanhoDoLote', () => {
  // Lote sempre igual a 10 é outro padrão reconhecível.
  it('varia em torno da base', () => {
    const baixo = tamanhoDoLote(10, () => 0)
    const alto = tamanhoDoLote(10, () => 0.999)
    expect(alto).toBeGreaterThan(baixo)
  })

  it('nunca devolve zero, que travaria a fila para sempre', () => {
    expect(tamanhoDoLote(10, () => 0)).toBeGreaterThanOrEqual(1)
    expect(tamanhoDoLote(1, () => 0)).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/disparos/__tests__/ritmo.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/disparos/ritmo"`

- [ ] **Step 3: Implementar**

```ts
// lib/disparos/ritmo.ts

/**
 * Ritmo do disparo, longe do envio em si.
 *
 * Tudo aqui é função pura com a aleatoriedade injetada: comportamento que
 * sorteia e não dá para testar acaba não sendo verificado, e é justo o tipo
 * de código onde um erro de sinal vira rajada em produção.
 */

/** Faixa de pausa entre envios. O 1200ms fixo de antes era o padrão a quebrar. */
export const PAUSA_MIN_MS = 4_000
export const PAUSA_MAX_MS = 18_000

/** Dias até um número novo alcançar o teto configurado. */
export const DIAS_AQUECIMENTO = 7

/** Quanto o primeiro dia representa do teto final. */
const FRACAO_PRIMEIRO_DIA = 0.1

export type Janela = { inicioHora: number; fimHora: number }

/** Fuso do usuário; o teto é por dia civil daqui, não por 24h móveis. */
const FUSO = 'America/Sao_Paulo'

export function pausaSorteada(
  minMs: number,
  maxMs: number,
  sorteio: () => number = Math.random,
): number {
  // Faixa invertida por engano de configuração não pode virar pausa negativa,
  // que transformaria o disparo em rajada.
  const min = Math.max(0, Math.min(minMs, maxMs))
  const max = Math.max(minMs, maxMs)
  return Math.round(min + sorteio() * (max - min))
}

/**
 * Se o momento está dentro da janela de envio.
 *
 * Mensagem comercial de madrugada é o que mais gera denúncia, e denúncia pesa
 * mais que volume no bloqueio do número.
 */
export function dentroDaJanela(agora: Date, janela: Janela): boolean {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: FUSO,
      hour: 'numeric',
      hour12: false,
    }).format(agora),
  )

  return hora >= janela.inicioHora && hora < janela.fimHora
}

/**
 * Teto de hoje, considerando aquecimento.
 *
 * Número novo que dispara centenas no primeiro dia é o caso clássico de
 * bloqueio imediato: a rampa sobe do décimo do teto até ele em uma semana.
 */
export function tetoDoDia(tetoConfigurado: number, diasDeUso: number): number {
  if (diasDeUso >= DIAS_AQUECIMENTO) return tetoConfigurado

  const fracao =
    FRACAO_PRIMEIRO_DIA +
    (1 - FRACAO_PRIMEIRO_DIA) * (diasDeUso / DIAS_AQUECIMENTO)

  // Nunca acima do configurado, mesmo com teto pequeno.
  return Math.min(tetoConfigurado, Math.max(1, Math.floor(tetoConfigurado * fracao)))
}

export function podeEnviar({
  enviadosHoje,
  teto,
}: {
  enviadosHoje: number
  teto: number
}): boolean {
  return enviadosHoje < teto
}

/**
 * Tamanho do lote com variação.
 *
 * Lote sempre igual a 10 é outro padrão reconhecível. Nunca zero: a fila
 * ficaria parada para sempre.
 */
export function tamanhoDoLote(
  base: number,
  sorteio: () => number = Math.random,
): number {
  const variacao = Math.round((sorteio() - 0.5) * base * 0.6)
  return Math.max(1, base + variacao)
}
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npx vitest run lib/disparos/__tests__/ritmo.test.ts`
Expected: PASS (19 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/disparos/ritmo.ts lib/disparos/__tests__/ritmo.test.ts
git commit -m "feat(disparo): domínio do ritmo, com pausa e lote variáveis"
```

---

### Task 2: Configuração por conexão

**Files:**
- Create: `supabase/migrations/0016_ritmo.sql`
- Test: verificação por consulta (sem teste unitário — é só schema)

**Interfaces:**
- Consumes: nada.
- Produces: colunas `instances.janela_inicio`, `instances.janela_fim`, `instances.teto_diario`, `instances.primeiro_envio_em`.

- [ ] **Step 1: Conferir o número livre**

Run: `ls supabase/migrations/ | tail -3`

Se `0014_esteira.sql` e `0015` já existirem, este arquivo é `0016_ritmo.sql`. Se não, ajustar para o próximo livre.

- [ ] **Step 2: Escrever a migration**

```sql
-- supabase/migrations/0016_ritmo.sql

-- Ritmo de disparo por conexão, e não global: números têm idades e
-- reputações diferentes, e um recém-criado não pode herdar o teto de um que
-- roda há meses.
alter table public.instances
  add column janela_inicio  smallint not null default 8,
  add column janela_fim     smallint not null default 20,
  add column teto_diario    integer  not null default 200,
  -- Marca o começo do aquecimento. Nulo enquanto nada saiu por esta conexão;
  -- o processador preenche no primeiro envio.
  add column primeiro_envio_em timestamptz;

alter table public.instances
  add constraint janela_valida check (
    janela_inicio between 0 and 23
    and janela_fim between 1 and 24
    and janela_inicio < janela_fim
  );

alter table public.instances
  add constraint teto_valido check (teto_diario between 1 and 5000);

comment on column public.instances.teto_diario is
  'Teto de envios por dia civil (America/Sao_Paulo), depois do aquecimento.';
```

- [ ] **Step 3: Aplicar e conferir**

Aplicar pelo SQL Editor do Supabase. Depois:

```bash
set -a; . ./.env; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/instances?select=evolution_name,janela_inicio,janela_fim,teto_diario,primeiro_envio_em" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: cada conexão com `janela_inicio: 8`, `janela_fim: 20`, `teto_diario: 200`, `primeiro_envio_em: null`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0016_ritmo.sql
git commit -m "feat(disparo): janela, teto e aquecimento por conexão"
```

---

### Task 3: O processador obedece ao ritmo

**Files:**
- Modify: `lib/disparos/processador.ts`
- Test: `lib/disparos/__tests__/processador.test.ts` (arquivo já existe, com 3 testes)

**Interfaces:**
- Consumes: tudo da Task 1; colunas da Task 2.
- Produces: `ResultadoLote` ganha o campo `adiado?: 'janela' | 'teto'`.

- [ ] **Step 1: Ler os testes que já existem**

Run: `cat lib/disparos/__tests__/processador.test.ts`

Os três casos atuais precisam continuar passando: o ritmo é acréscimo, não substituição do que já funciona.

- [ ] **Step 2: Escrever os testes novos, falhando**

Acrescentar ao arquivo existente, adaptando os mocks já usados nele:

```ts
describe('ritmo', () => {
  // Fora da janela o lote adia, não falha: marcar falha gastaria a tentativa
  // e sujaria o relatório do disparo com erro que não é erro.
  it('adia o lote fora da janela, sem marcar falha', async () => {
    // instância com janela 8-20; relógio às 3h de São Paulo
    vi.setSystemTime(new Date('2026-08-21T03:00:00-03:00'))

    const r = await processarLote(db(), 'disparo-1')

    expect(r.adiado).toBe('janela')
    expect(r.enviados).toBe(0)
    expect(r.falhas).toBe(0)
    vi.useRealTimers()
  })

  it('adia quando o teto do dia já foi atingido', async () => {
    vi.setSystemTime(new Date('2026-08-21T12:00:00-03:00'))
    estado.enviadosHoje = 200 // igual ao teto_diario

    const r = await processarLote(db(), 'disparo-1')

    expect(r.adiado).toBe('teto')
    expect(r.enviados).toBe(0)
    vi.useRealTimers()
  })

  // Aquecimento: conexão que nunca enviou tem teto muito menor que o
  // configurado, ainda que o usuário tenha pedido 200.
  it('aplica o teto reduzido de número novo', async () => {
    vi.setSystemTime(new Date('2026-08-21T12:00:00-03:00'))
    estado.primeiroEnvioEm = null
    estado.enviadosHoje = 25

    const r = await processarLote(db(), 'disparo-1')

    expect(r.adiado).toBe('teto')
    vi.useRealTimers()
  })

  // O primeiro envio marca o início do aquecimento; sem isso a rampa nunca
  // sairia do dia zero.
  it('marca primeiro_envio_em no primeiro lote que sai', async () => {
    vi.setSystemTime(new Date('2026-08-21T12:00:00-03:00'))
    estado.primeiroEnvioEm = null
    estado.enviadosHoje = 0

    await processarLote(db(), 'disparo-1')

    expect(estado.updates.some((u) => 'primeiro_envio_em' in u)).toBe(true)
    vi.useRealTimers()
  })
})
```

> Ao executar: adaptar `estado`, `db()` e a importação de `processarLote` ao que o arquivo de teste já define. Não reescrever os mocks existentes — estendê-los com `enviadosHoje`, `primeiroEnvioEm` e as colunas da 0016 na instância simulada.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run lib/disparos/__tests__/processador.test.ts`
Expected: FAIL nos 4 casos novos; os 3 antigos continuam passando.

- [ ] **Step 4: Implementar no processador**

Alterações em `lib/disparos/processador.ts`:

1. Trocar o `select` da instância para trazer `janela_inicio, janela_fim, teto_diario, primeiro_envio_em`.
2. Antes do laço de envio, aplicar os portões:

```ts
const janela = {
  inicioHora: Number(instancia.janela_inicio),
  fimHora: Number(instancia.janela_fim),
}

if (!dentroDaJanela(new Date(), janela)) {
  // Adia, não falha: a próxima execução do cron pega de novo.
  return { disparo: disparo.id, enviados: 0, falhas: 0, restantes: pendentes.length, adiado: 'janela' }
}

const diasDeUso = instancia.primeiro_envio_em
  ? Math.floor((Date.now() - new Date(String(instancia.primeiro_envio_em)).getTime()) / 86_400_000)
  : 0

const teto = tetoDoDia(Number(instancia.teto_diario), diasDeUso)

if (!podeEnviar({ enviadosHoje, teto })) {
  return { disparo: disparo.id, enviados: 0, falhas: 0, restantes: pendentes.length, adiado: 'teto' }
}
```

3. `enviadosHoje` vem de uma contagem de `mensagens` do dono, direção `saida`, a partir da meia-noite de São Paulo.
4. Trocar `TAMANHO_LOTE` fixo por `tamanhoDoLote(TAMANHO_LOTE)` no `.limit()`.
5. Trocar `await dormir(PAUSA_ENTRE_ENVIOS_MS)` por `await dormir(pausaSorteada(PAUSA_MIN_MS, PAUSA_MAX_MS))`.
6. No primeiro envio bem-sucedido com `primeiro_envio_em` nulo, gravá-lo.

> **Cuidado com o tempo de função:** a pausa média sobe de 1,2s para ~11s. Com lote de 10, um ciclo passa de ~12s para ~110s. Conferir o limite de execução da rota `/api/disparos/processar` no ambiente de deploy; se for menor que isso, reduzir `TAMANHO_LOTE` para caber, em vez de encurtar a pausa — a fila continua na execução seguinte.

- [ ] **Step 5: Rodar e confirmar verde**

Run: `npx vitest run lib/disparos/__tests__/processador.test.ts`
Expected: PASS (7 testes — 3 antigos + 4 novos)

- [ ] **Step 6: Typecheck e suíte**

Run: `npx tsc --noEmit && npm run test:run`
Expected: ambos limpos.

- [ ] **Step 7: Commit**

```bash
git add lib/disparos/
git commit -m "feat(disparo): ritmo variável, janela de horário e teto diário"
```

---

### Task 4: Configurar o ritmo pela tela

**Files:**
- Modify: `app/(app)/conexao/actions.ts` (nova action `salvarRitmo`)
- Modify: `app/(app)/conexao/painel-conexao.tsx` (formulário)
- Test: `app/(app)/conexao/__tests__/painel-conexao.test.tsx`

**Interfaces:**
- Consumes: colunas da Task 2.
- Produces: `salvarRitmo(id: string, dados: { janelaInicio: number; janelaFim: number; tetoDiario: number }): Promise<EstadoConexaoUi>`.

- [ ] **Step 1: Escrever o teste falhando**

```ts
// acrescentar a app/(app)/conexao/__tests__/painel-conexao.test.tsx
describe('ritmo de disparo', () => {
  it('mostra a janela e o teto da conexão', async () => {
    render(
      <PainelConexao
        conexoes={[
          {
            id: 'c1',
            nome: 'teste',
            status: 'conectada',
            numero: null,
            janelaInicio: 8,
            janelaFim: 20,
            tetoDiario: 200,
          },
        ]}
      />,
    )
    expect(await screen.findByLabelText(/Enviar a partir de/)).toHaveValue('8')
    expect(await screen.findByLabelText(/Enviar até/)).toHaveValue('20')
    expect(await screen.findByLabelText(/Máximo por dia/)).toHaveValue(200)
  })

  // Janela invertida passaria pelo check do banco como erro 23514, que a
  // tela traduziria mal; barrar antes dá mensagem melhor.
  it('recusa janela invertida antes de chamar o servidor', async () => {
    render(<PainelConexao conexoes={[/* mesma conexão */]} />)

    await userEvent.clear(await screen.findByLabelText(/Enviar a partir de/))
    await userEvent.type(screen.getByLabelText(/Enviar a partir de/), '22')
    await userEvent.click(screen.getByRole('button', { name: /Salvar ritmo/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/antes/i)
    expect(acoes.salvarRitmo).not.toHaveBeenCalled()
  })

  it('salva os valores válidos', async () => {
    render(<PainelConexao conexoes={[/* mesma conexão */]} />)

    await userEvent.clear(screen.getByLabelText(/Máximo por dia/))
    await userEvent.type(screen.getByLabelText(/Máximo por dia/), '50')
    await userEvent.click(screen.getByRole('button', { name: /Salvar ritmo/ }))

    expect(acoes.salvarRitmo).toHaveBeenCalledWith('c1', {
      janelaInicio: 8,
      janelaFim: 20,
      tetoDiario: 50,
    })
  })
})
```

> Ao executar: adaptar às props reais de `PainelConexao` e ao mock de ações já existente no arquivo, acrescentando `salvarRitmo`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run 'app/(app)/conexao/__tests__/painel-conexao.test.tsx'`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar a action**

```ts
// acrescentar a app/(app)/conexao/actions.ts
export async function salvarRitmo(
  id: string,
  dados: { janelaInicio: number; janelaFim: number; tetoDiario: number },
): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { janelaInicio, janelaFim, tetoDiario } = dados

  // Espelha os checks da 0016. Server action é chamável por requisição HTTP
  // direta, então validar só na tela não protegeria nada.
  if (
    !Number.isInteger(janelaInicio) ||
    !Number.isInteger(janelaFim) ||
    janelaInicio < 0 ||
    janelaFim > 24 ||
    janelaInicio >= janelaFim
  ) {
    return { erro: 'A hora de início precisa vir antes da hora de fim.' }
  }

  if (!Number.isInteger(tetoDiario) || tetoDiario < 1 || tetoDiario > 5000) {
    return { erro: 'O máximo por dia precisa ficar entre 1 e 5000.' }
  }

  const { error } = await supabase
    .from('instances')
    .update({
      janela_inicio: janelaInicio,
      janela_fim: janelaFim,
      teto_diario: tetoDiario,
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível salvar o ritmo.' }

  revalidatePath('/conexao')
  return { ok: true }
}
```

- [ ] **Step 4: Implementar o formulário**

Em `painel-conexao.tsx`, acrescentar por conexão três campos numéricos (`Enviar a partir de`, `Enviar até`, `Máximo por dia`) e um botão `Salvar ritmo`, com a mesma validação de janela antes de chamar a action. Incluir a nota de que número novo envia menos nos primeiros dias, para o usuário não achar que o teto está quebrado.

Ajustar `lib/consultas/conexao.ts` para devolver as três colunas novas.

- [ ] **Step 5: Rodar e confirmar verde**

Run: `npx vitest run 'app/(app)/conexao/__tests__/painel-conexao.test.tsx'`
Expected: PASS

- [ ] **Step 6: Typecheck, suíte e build**

Run: `npx tsc --noEmit && npm run test:run && npm run build`
Expected: os três limpos. Restaurar `next-env.d.ts` antes de commitar.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(conexao): configurar janela, teto e ver o aquecimento"
```

---

## Verificação final

- [ ] `npm run test:run` — suíte verde
- [ ] `npx tsc --noEmit` — limpo
- [ ] `npm run build` — completo
- [ ] Disparo fora da janela não envia e não marca falha
- [ ] Dois disparos seguidos mostram pausas visivelmente diferentes no log
- [ ] Conexão nova envia bem menos que o teto configurado no primeiro dia
- [ ] `git status` limpo

## O que este plano deliberadamente NÃO faz

- **Não torna o uso conforme às regras da Meta.** Ver o aviso no topo.
- **Não varia o texto da mensagem.** Enviar o mesmo texto para centenas de números é um sinal tão forte quanto a cadência, e resolvê-lo bem exige variações escritas pelo usuário — escopo próprio, com tela própria.
- **Não distribui envios entre várias conexões** (rotação de número). Faz diferença de verdade em volume alto, mas depende de decidir qual conexão atende qual contato, o que muda o modelo de conversa.
- **Não mede reputação do número** nem lê qualquer sinal de saúde do WhatsApp. A API não oferece isso; o que existe é inferência a partir de taxa de entrega, e isso pertence ao plano de inteligência.
