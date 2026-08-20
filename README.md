# ZapCRM

CRM de WhatsApp construído sobre a [Evolution API](https://docs.evolutionfoundation.com.br/evolution-api/index).

## Stack

Next.js 16, React 19, Tailwind 4, Supabase (Postgres, Auth, Realtime),
Evolution API v2, Vitest.

## Rodando localmente

```bash
pnpm install
cp .env.example .env    # preencher: ver docs/deploy-evolution.md
pnpm dev
```

Testes:

```bash
pnpm test        # watch
pnpm test:run    # uma vez
```

Os testes de RLS precisam de um Supabase configurado no `.env` e das contas
`teste-a@exemplo.com` e `teste-b@exemplo.com` (senha `senha-de-teste-123`).
Sem isso eles são pulados.

## Como as peças se encaixam

- **Vercel** — dashboard Next.js
- **Supabase** — banco, autenticação, tempo real; também é o banco da Evolution
  (schema `evolution`)
- **Evolution API** — Docker no Render; mantém as sessões do WhatsApp

A `EVOLUTION_API_KEY` é server-only e nunca chega ao navegador. O mesmo vale
para a `SUPABASE_SERVICE_ROLE_KEY`.

## Contas de usuário

Não há tela de registro. Contas nascem em Authentication > Users no painel
do Supabase; um trigger cria o perfil correspondente. Todo dado de usuário é
isolado por `owner_id` com Row Level Security no Postgres.

## As sete telas

| Rota | O que faz hoje |
|------|----------------|
| `/` | Dashboard: cartões de resumo, gráficos e painéis de conversas e conexões |
| `/conexao` | Instâncias de WhatsApp, status e bateria; diálogo de nova conexão |
| `/contatos` | Base de contatos com busca, seleção e exclusão; novo contato e importação |
| `/mensagens` | Conversas com busca, não lidas e status de entrega |
| `/midias` | Biblioteca de arquivos; diálogo de envio |
| `/disparos` | Campanhas com progresso de entrega; diálogo de novo disparo |
| `/configuracoes` | Perfil real do Supabase, tema e preferências de notificação |

### Dados de exemplo

A interface nasce preenchida com dados de exemplo, para que dê para ver o
formato de cada tela antes de conectar um WhatsApp. O selo no topo alterna
entre exemplo e vazio; a escolha fica no `localStorage`. Com o exemplo
desligado, cada tela cai no seu estado vazio e nenhum número inventado
aparece — inclusive os contadores da sidebar.

Salvar o nome em Configurações é a única escrita que já vai ao banco. O
resto da interação com o WhatsApp — QR code, envio, disparo de verdade —
chega nas entregas seguintes.

## Documentação

- `docs/superpowers/specs/` — decisões de design por entrega
- `docs/superpowers/plans/` — planos de implementação
- `docs/deploy-evolution.md` — subir a Evolution no Render
- `docs/endpoints-evolution-confirmados.md` — endpoints verificados

## Estado

Entrega 1 (Fundação) concluída: autenticação, banco multi-tenant com RLS,
navegação entre as sete telas, camada tipada de acesso à Evolution e
receptor de webhook. As telas já mostram a interface completa, mas ainda
sobre dados de exemplo — ligar a Evolution de verdade é a Entrega 2.

O sino da topbar avisa ao vivo sobre mensagem recebida, campanha concluída e
queda de conexão, pelo Realtime do Supabase. Cada tipo é controlado pelo seu
interruptor em Configurações, e desligado significa não criar.
