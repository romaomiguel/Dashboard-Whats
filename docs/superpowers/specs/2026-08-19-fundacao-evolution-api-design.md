# Fundação — Integração do ZapCRM com a Evolution API

**Data:** 2026-08-19
**Entrega:** 1 de 6
**Status:** entregue em 2026-08-19

## Contexto

O `dashboard-crm-whats-app` é hoje um mockup estático gerado pelo v0: Next.js 16,
React 19, Tailwind 4. Não possui backend, banco, autenticação nem chamadas de rede.
Todo o conteúdo vem de constantes em `lib/data.ts`. A sidebar
(`components/sidebar.tsx`) alterna um `useState` e não navega — as telas Conexão,
Contatos, Mensagens, Mídias, Disparos e Configurações não existem como rotas.

O objetivo do projeto é transformá-lo num CRM de WhatsApp funcional, multi-usuário,
apoiado na [Evolution API](https://docs.evolutionfoundation.com.br/evolution-api/index).

Esta spec cobre apenas a **Entrega 1: Fundação**. As outras cinco estão listadas ao
final e ganharão specs próprias.

## Objetivo desta entrega

Ao final, o usuário faz login, navega entre as sete telas reais, e o sistema sabe
quem ele é e qual instância da Evolution lhe pertence. As telas ainda exibem dados
de exemplo, marcados visualmente como tal. Nenhuma funcionalidade de WhatsApp é
implementada aqui — ela depende desta base.

## Decisões tomadas

| Decisão | Escolha | Razão |
|---|---|---|
| Hospedagem do dashboard | Vercel | Escolha do usuário; free tier atende |
| Banco, auth, tempo real | Supabase | Free tier cobre tudo; Realtime substitui SSE, problemático em serverless |
| Hospedagem da Evolution | Render (Docker, free) | Escolha do usuário; ver "Riscos" |
| Banco da Evolution | O mesmo Postgres do Supabase, em schema separado | O Postgres free do Render expira em 30 dias e levaria junto as credenciais das sessões |
| Redis | Não usar (`CACHE_LOCAL_ENABLED`) | Evita um segundo serviço no Render; perda apenas de performance |
| Multi-tenancy | `owner_id` + RLS em todas as tabelas | Isolamento garantido no banco, não na aplicação |
| Instâncias por usuário | Exatamente uma | Simplifica schema e telas; coerente com o limite de RAM do Render free |
| Cadastro | Fechado — contas criadas no painel do Supabase | Evita terceiros consumindo os 512 MB do servidor |
| Papel de admin | Não existe | Administração pelo painel do Supabase |
| Worker de disparo | Junto da Evolution, não na Vercel | Vercel Hobby limita cron a 1x/dia com timeout de 10s |

## Arquitetura

O diagrama abaixo descreve o sistema completo, ao fim das seis entregas. Em
desenvolvimento, a Evolution roda local com Postgres próprio (ver "Configuração"), e
o receptor de webhook só ganha lógica de fato na Entrega 2.

```
┌──────────────┐      sessão Baileys (WS)     ┌─────────────────────┐
│   WhatsApp   │◄────────────────────────────►│  Evolution API      │
└──────────────┘                              │  (Render, Docker)   │
                                              └──────────┬──────────┘
                                                         │
                              REST (header apikey)       │  webhook POST
                        ┌────────────────────────────────┤
                        │                                ▼
              ┌─────────┴──────────┐          ┌──────────────────────┐
              │  Next.js (Vercel)  │─────────►│  Supabase            │
              │  Route Handlers    │          │  Postgres + Auth     │
              │  + UI              │◄─────────│  + Realtime          │
              └────────────────────┘ Realtime └──────────┬───────────┘
                                                         │
                                    schema `evolution` — dados da Evolution
                                    schema `public`    — dados do app
```

Pontos-chave:

- A `EVOLUTION_API_KEY` vive **apenas** no servidor. Toda chamada à Evolution passa
  por Route Handler do Next.js. O navegador nunca a recebe.
- Um único banco Postgres (Supabase) serve os dois lados, em schemas distintos.
  A Evolution grava no schema definido por `DATABASE_CONNECTION_CLIENT_NAME`;
  o app usa `public`.
- O receptor de webhook usa a *service role key* (ignora RLS), pois não há sessão de
  usuário na requisição. Ele resolve o dono pelo campo `instance` do payload.

## Modelo de dados

Migration `supabase/migrations/0001_fundacao.sql`.

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  criado_em  timestamptz not null default now()
);

create type public.instance_status as enum (
  'criada', 'conectando', 'conectada', 'desconectada'
);

create table public.instances (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  evolution_name  text not null unique,
  token           text,
  numero          text,
  status          public.instance_status not null default 'criada',
  atualizado_em   timestamptz not null default now(),
  constraint uma_instancia_por_usuario unique (owner_id)
);
```

`uma_instancia_por_usuario` implementa a decisão de uma instância por pessoa no
banco, não apenas na aplicação.

`evolution_name` é o identificador usado na Evolution (formato `inst_<8 hex>`).
Deliberadamente não é o e-mail nem o UUID do usuário: o nome aparece em logs da
Evolution e não deve carregar identidade.

### RLS

```sql
alter table public.profiles  enable row level security;
alter table public.instances enable row level security;

create policy proprio_perfil on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy propria_instancia on public.instances
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

### Trigger de criação de perfil

Ao criar a conta no painel do Supabase, o perfil nasce junto.

```sql
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $func$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  return new;
end
$func$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## Camada de integração com a Evolution

Pasta `lib/evolution/`:

**`endpoints.ts`** — todos os paths da API em um só lugar. A concentração é
deliberada: a documentação do Evolution Foundation cobre instalação, variáveis de
ambiente e webhooks, mas não publica referência REST endpoint-a-endpoint. Os paths
abaixo seguem as convenções da Evolution API v2 e **precisam ser conferidos contra a
instância real**. Divergindo, ajusta-se um arquivo apenas.

```
instância:  POST   /instance/create
            GET    /instance/connect/{instance}
            GET    /instance/connectionState/{instance}
            GET    /instance/fetchInstances
            DELETE /instance/logout/{instance}
            DELETE /instance/delete/{instance}
webhook:    POST   /webhook/set/{instance}    (doc do Foundation cita /webhook/instance)
            GET    /webhook/find/{instance}
mensagem:   POST   /message/sendText/{instance}
            POST   /message/sendMedia/{instance}
chat:       POST   /chat/findContacts/{instance}
            POST   /chat/findChats/{instance}
            POST   /chat/findMessages/{instance}
```

**`client.ts`** — wrapper de `fetch` que monta a URL a partir de
`EVOLUTION_API_URL`, injeta o header `apikey`, aplica timeout e converte falha em
`EvolutionError` tipado, distinguindo quatro casos: rede indisponível, 401 (apikey
inválida), 404 (instância inexistente) e 5xx.

**`instances.ts`** — funções tipadas sobre os endpoints de instância. Apenas
`create`, `connect`, `connectionState`, `logout`, `delete` e `setWebhook` nesta
entrega. As demais chegam com as entregas que as usam.

**`types.ts`** — tipos das respostas.

Nesta entrega a camada é escrita e testada, mas nenhuma tela a consome ainda.

## Autenticação

Supabase Auth, e-mail e senha, com `@supabase/ssr`:

- `lib/supabase/server.ts` — cliente para Server Components e Route Handlers
- `lib/supabase/client.ts` — cliente para Client Components
- `lib/supabase/admin.ts` — cliente com service role, uso restrito ao webhook
- `middleware.ts` — renova a sessão e redireciona anônimos para `/login`.
  Exceções: `/login` e `/api/webhooks/*`

Não há tela de registro. Contas nascem no painel do Supabase; o trigger cria o
perfil automaticamente.

## Navegação

Reestruturação do que já existe:

```
app/
  layout.tsx                  (mantido: fontes, ThemeProvider)
  login/page.tsx              (novo)
  (app)/
    layout.tsx                (novo: Sidebar + Topbar, movidos de page.tsx)
    page.tsx                  Home — conteúdo atual, com selo "dados de exemplo"
    conexao/page.tsx          (placeholder)
    contatos/page.tsx         (placeholder)
    mensagens/page.tsx        (placeholder)
    midias/page.tsx           (placeholder)
    disparos/page.tsx         (placeholder)
    configuracoes/page.tsx    (placeholder)
  api/webhooks/evolution/route.ts   (esqueleto: valida segredo, registra, responde 200)
```

`components/sidebar.tsx` troca `useState` por `<Link>` + `usePathname()`. Os
placeholders são telas honestas ("em construção"), não páginas vazias.

`lib/data.ts` permanece alimentando a Home. Cada entrega seguinte remove uma parte
dele. O projeto nunca fica quebrado entre entregas.

### Zerar os dados de exemplo

A Home traz um selo "Dados de exemplo" com uma ação **Zerar** ao lado. Acionada, o
dashboard passa a exibir o estado real — que na Entrega 1 é vazio: contadores em
zero, gráficos sem série, listas com mensagem de estado vazio ("Nenhuma conversa
ainda. Conecte seu WhatsApp em Conexão."). A ação é reversível por um botão
**Restaurar exemplo** que aparece no lugar.

A preferência vive em `localStorage` sob a chave `zapcrm:dados-exemplo`, não no
banco: é preferência de exibição, não dado de negócio, e não vale uma coluna nem uma
round-trip. O padrão é ligado.

Isso obriga cada componente da Home a ter um caminho de estado vazio já na Entrega 1
— trabalho que seria necessário de qualquer forma quando os dados reais chegarem na
Entrega 5, feito agora e testado desde já.

## Configuração

`.env.example`:

```
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Dois arquivos de infraestrutura:

- **`render.yaml`** — Evolution como serviço Docker único, com
  `DATABASE_CONNECTION_URI` apontando para o Supabase. **É o ambiente principal**
  (ver "Ordem de trabalho" abaixo).
- **`docker-compose.yml`** — opcional, para quem tiver Docker local. Evolution +
  Postgres, iteração mais rápida e sem os limites do plano free.

### Ordem de trabalho

A máquina de desenvolvimento não tem Docker instalado, e os paths da Evolution
precisam ser confirmados contra uma instância real antes de escrever código em cima
deles. Portanto:

1. **Subir a Evolution no Render primeiro**, usando o `render.yaml` desta spec.
2. **Confirmar cada endpoint** por `curl` contra a URL pública, ajustando
   `endpoints.ts`.
3. **Desenvolver o dashboard localmente** com `EVOLUTION_API_URL` apontando para o
   Render. Funciona sem atrito: as chamadas são de saída.

O `docker-compose.yml` fica disponível caso você instale o Docker Desktop depois —
vale a pena se o spin-down do Render incomodar, mas não bloqueia nada.

**Consequência para a Entrega 2:** webhooks vão no sentido inverso — a Evolution no
Render precisa alcançar o dashboard. Um Next.js em `localhost:3000` não é alcançável
de fora. Serão necessários um túnel gratuito (cloudflared ou ngrok) ou testar contra
o dashboard já publicado na Vercel. Decisão fica para a spec da Entrega 2.

Variáveis da Evolution no Render:

```
SERVER_URL=https://<servico>.onrender.com
AUTHENTICATION_API_KEY=<gerada>
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=<uri do Supabase>
DATABASE_CONNECTION_CLIENT_NAME=evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
CONFIG_SESSION_PHONE_CLIENT=ZapCRM
WEBHOOK_GLOBAL_ENABLED=false
```

`DATABASE_CONNECTION_CLIENT_NAME=evolution` isola as tabelas da Evolution em schema
próprio, evitando colisão com as do app no mesmo banco.

## Testes

O projeto não possui infraestrutura de teste. Adicionar **Vitest**. Desenvolvimento
guiado por testes, escritos antes da implementação:

- **`lib/evolution/client`**, contra servidor mock: header `apikey` presente; URL
  montada corretamente; 401 vira `EvolutionError` de autenticação; 404 vira erro de
  instância; rede fora do ar vira erro de conexão e não trava a requisição.
- **RLS**, contra o Supabase de desenvolvimento: usuário A não lê nem escreve a
  instância do usuário B; a service role lê ambas.
- **Trigger de perfil**: criar usuário em `auth.users` cria a linha em `profiles`.
- **Middleware**: anônimo em `/conexao` é redirecionado para `/login`;
  `/api/webhooks/evolution` permanece acessível sem sessão.
- **Estado vazio da Home**: com `zapcrm:dados-exemplo` desligado, cada card e
  gráfico renderiza seu estado vazio sem quebrar; ligado, volta aos dados de
  exemplo.

## Fora do escopo desta entrega

Conectar WhatsApp, ler QR code, listar contatos, ver ou enviar mensagens, disparos,
notificações reais, galeria de mídias, tela de configurações funcional. Todas
dependem desta base e vêm nas entregas seguintes.

## Riscos e incertezas

**1. Paths da Evolution não confirmados.** A documentação do Evolution Foundation
não publica referência REST endpoint-a-endpoint; os paths seguem convenções da v2.
*Mitigação:* a primeira tarefa do plano é subir a Evolution no Render e conferir
cada path por `curl` contra ela, antes de escrever código que os use.
`endpoints.ts` concentra o ajuste em um arquivo.

**2. 512 MB de RAM no Render free.** Cada sessão Baileys consome 150–300 MB, o que
comporta uma a duas instâncias. Com três, o serviço reinicia por falta de memória.
*Mitigação:* nenhuma técnica — é limite de plano. Render Starter (~US$ 7/mês) ou
Standard (~US$ 25/mês, 2 GB) resolvem sem mudança de código.

**3. Spin-down após 15 minutos derruba a sessão do WhatsApp.** *Mitigação:* ping
externo a cada 10 minutos (cron-job.org ou UptimeRobot, gratuitos). Consome quase
integralmente a cota de 750 horas/mês, suficiente para um serviço.

**4. 500 MB do Supabase free compartilhados entre Evolution e app.** Com
`DATABASE_SAVE_DATA_NEW_MESSAGE` ligado, a Evolution grava todas as mensagens no
mesmo banco; o volume cresce rápido. *Mitigação:* monitorar; se apertar, aplicar
retenção ou desligar a gravação de mensagens. Decisão adiada para a Entrega 3, que é
quem realmente lê mensagens.

**5. Versão da Evolution.** v1 e v2 divergem em rotas de webhook e formato de
payload. *Mitigação:* fixar a tag da imagem Docker no `docker-compose.yml` e no
`render.yaml`, e registrar a versão usada.

## Entregas seguintes

| # | Entrega | Conteúdo |
|---|---|---|
| 2 | Conexão | Criar instância, QR code, status ao vivo, webhook completo, Realtime |
| 3 | Contatos e Mensagens | Lista de contatos, tela de conversa, envio individual |
| 4 | Disparos | Campanhas, fila com intervalo anti-ban, worker, progresso ao vivo |
| 5 | Home e Notificações | Métricas e gráficos reais, sino funcional |
| 6 | Mídias e Configurações | Galeria via Supabase Storage, preferências |
