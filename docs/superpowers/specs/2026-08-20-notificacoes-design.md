# Notificações — sino ao vivo e preferências

**Data:** 2026-08-20
**Status:** aprovada

## Contexto

O ZapCRM já registra tudo o que uma notificação precisaria anunciar, mas não
avisa ninguém. Mensagem recebida entra em `public.mensagens` pelo receptor de
webhook. Campanha concluída muda de status no processador de disparos. Queda de
conexão chega como evento `CONNECTION_UPDATE`, que a instância já assina.

Falta a ponte. O sino em `components/topbar.tsx` está desabilitado com um
tooltip dizendo que chega depois, e os três interruptores do card
"Notificações" em `app/(app)/configuracoes/preferencias.tsx` são decorativos:
usam `defaultChecked` e não gravam nada.

Esta é a última peça para fechar o projeto.

## Objetivo

Avisar dentro do app, ao vivo, sobre três coisas:

1. Uma conversa nova recebeu mensagem
2. Uma campanha de disparo terminou
3. Uma conexão de WhatsApp caiu

Cada uma controlada pelo interruptor correspondente em Configurações.

## Decisões tomadas

**Alcance: só dentro do app, ao vivo.** Sem push do navegador e sem e-mail. O
Realtime do Supabase já vem no plano free e não pede infraestrutura nova. Com o
painel fechado, o usuário vê ao voltar.

**Granularidade: uma por conversa.** Um disparo para 300 pessoas com 40
respostas gera 40 notificações, não 40 × número de mensagens. A mesma pessoa
mandando três mensagens seguidas atualiza a mesma linha.

**Ao clicar: vai para a tela que já existe.** A notificação de mensagem leva a
`/mensagens` com a busca preenchida no número. Só a busca viaja na URL — o
filtro por estado é estado de cliente e não é endereçável —, e buscar o número
já reduz a lista àquela conversa. Não haverá tela de conversa em detalhe —
seria maior que a própria funcionalidade.

**Retenção: 30 dias, sem depender de cron.** A limpeza acontece junto de cada
gravação, não numa rotina agendada. O cron de disparos é opcional e ainda não
foi configurado; retenção que depende de algo opcional não é retenção.

**Tabela própria, não derivada.** Considerou-se calcular o sino a partir de
`mensagens`, `disparos` e `instances`, sem tabela nova. Foi descartado porque
"lida" viraria uma marca d'água única — não daria para dispensar uma
notificação e manter outra.

## Modelo de dados

```sql
create type public.notificacao_tipo as enum ('mensagem', 'disparo', 'conexao');

create table public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  tipo           public.notificacao_tipo not null,
  chave          text not null,
  titulo         text not null,
  corpo          text,
  destino        text,
  lida           boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint notificacao_unica_por_dono unique (owner_id, chave)
);
```

A **chave** é o que agrupa: `mensagem:5565984627628`, `disparo:<uuid>`,
`conexao:<uuid>`. O número usa a forma canônica de `lib/numeros.ts`, sem o nono
dígito — senão a mesma pessoa geraria duas notificações, como já aconteceu com
as conversas.

O `unique (owner_id, chave)` é uma restrição completa, não um índice parcial. A
migration 0010 criou um índice parcial e o Postgres não conseguiu inferi-lo no
`ON CONFLICT`, o que fez toda gravação do webhook responder 42P10. Não repetir.

Chegando atividade nova na mesma chave, o `upsert` atualiza `titulo`, `corpo`,
`atualizado_em` e devolve `lida` para `false`.

**Índice de leitura:** `(owner_id, lida, atualizado_em desc)`.

A ordenação é por `atualizado_em`, não por `criado_em`: uma conversa antiga que
recebe mensagem nova precisa subir para o topo do sino. `criado_em` fica só
como registro de quando a notificação nasceu.

**RLS:** política `for all to authenticated` comparando
`owner_id = (select auth.uid())`, no formato da migration 0009.

**Realtime:** `alter publication supabase_realtime add table public.notificacoes`.
Sem isso o canal conecta e nunca recebe nada — falha silenciosa.

**Preferências:** três colunas em `profiles`, com padrão ligado.

```sql
alter table public.profiles
  add column notificar_mensagem boolean not null default true,
  add column notificar_disparo  boolean not null default true,
  add column notificar_conexao  boolean not null default true;
```

Três interruptores não justificam tabela própria.

## Produtores

Um único ponto de gravação, `registrarNotificacao(db, evento)`, concentra a
consulta de preferência, a montagem do texto e o upsert. Os produtores só
relatam o que aconteceu; nenhum deles sabe o que é uma preferência.

| Origem | Gatilho | Título | Destino |
|---|---|---|---|
| `app/api/webhooks/evolution/[segredo]/route.ts` | `MESSAGES_UPSERT` de entrada | `<nome> respondeu` | `/mensagens?busca=<numero>` |

| `app/api/webhooks/evolution/[segredo]/route.ts` | `CONNECTION_UPDATE` para `close` **vindo de conectada** | `<conexão> desconectou` | `/conexao` |
| `lib/disparos/processador.ts` | campanha muda para concluído | `<campanha> concluída` | `/disparos` |

A conexão precisa da condição "vindo de conectada" porque toda instância nasce
fechada: sem isso, criar uma conexão avisaria que ela caiu antes mesmo de o QR
ser lido. A comparação é com o `status` gravado em `public.instances`.

Falha ao notificar **não** pode derrubar quem chamou: uma notificação perdida é
menos grave que um evento de webhook reenviado em laço ou um disparo
interrompido. Cada chamada é isolada e registrada no log.

## Entrega ao vivo

`components/sino-notificacoes.tsx`, componente de cliente, recebe a lista
inicial do servidor — renderizada no primeiro carregamento, sem esperar rede — e
assina `postgres_changes` na tabela, filtrando por `owner_id`.

- Contador no sino mostra não lidas; some no zero
- O painel lista as recentes, com ícone por tipo e tempo relativo
- Clicar marca como lida e navega para `destino`
- "Marcar todas como lidas" no rodapé do painel
- Sem nenhuma: estado vazio dizendo que aparecerão ali

A assinatura é cancelada ao desmontar, e o componente tolera o canal cair: se o
Realtime não conectar, a lista inicial continua correta e atualiza na próxima
navegação.

## Preferências

`app/(app)/configuracoes/preferencias.tsx` deixa de ser estático. Os três
interruptores recebem o valor do perfil e gravam por server action ao alternar,
sem botão de salvar — é uma preferência, não um formulário.

Desligado significa **não criar**, não "criar e esconder". Assim o desligado
não acumula linha no banco.

## Retenção

Ao gravar uma notificação, apagar as do mesmo dono que estejam lidas e com mais
de 30 dias. Consulta indexada, custo desprezível, e o sistema se mantém sozinho
sem depender de agendador externo.

## Testes

Testável sem banco, com Vitest:

- Montagem de título, corpo e destino a partir de cada tipo de evento
- Chave de agrupamento, incluindo a forma canônica do número
- O portão de preferência: desligado não grava
- O sino: contador, marcação individual, marcar todas, estado vazio

Fora do alcance do teste automatizado, para verificação manual:

- O canal de Realtime entregando de fato
- A publicação da tabela no Realtime ter sido aplicada

## Fora do escopo

- Push do navegador e notificação por e-mail
- Tela de conversa em detalhe
- Notificação de mensagem enviada, entregue ou lida — só resposta recebida
- Agrupar por campanha ("40 pessoas responderam")
- Som ou notificação do sistema operacional

## Riscos

**A publicação no Realtime falha em silêncio.** Esquecendo o `alter
publication`, tudo funciona menos a atualização ao vivo, e sem erro. Mitigação:
a migration traz o comando, e a verificação manual inclui receber uma
notificação com o painel aberto.

**Duplicação com `mensagens`.** A notificação guarda um resumo do que já está
em outra tabela, e as duas podem discordar se a mensagem for apagada. Aceito: a
notificação é um aviso datado, não a fonte da verdade, e o destino sempre leva
à tela que mostra o estado real.

**Volume num disparo grande.** 300 respostas viram 300 notificações. A
granularidade por conversa é o teto, e a retenção de 30 dias impede o acúmulo
entre campanhas.
