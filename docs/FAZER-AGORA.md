# O que fazer agora

O erro no passo de medição revelou duas coisas. A ordem mudou: o **passo 0 é
urgente** e deve ser feito antes de qualquer outro.

---

## Passo 0 — URGENTE: fechar as tabelas da Evolution

### O que está acontecendo

As tabelas da Evolution ficaram no schema `public`, o mesmo que o Supabase
publica pela API REST, e **sem proteção**. A chave anônima — aquela que vai no
JavaScript de toda página do seu site, visível para qualquer visitante — hoje
consegue:

| Tabela | Linhas | O que contém |
|---|---|---|
| `Message` | **150.525** | O conteúdo de todas as mensagens |
| `Contact` | 3.697 | Sua agenda inteira, com nomes e fotos |
| `Chat` | 3.503 | Todas as conversas |
| `Session` | — | **As credenciais da sessão do WhatsApp** |
| `Instance` | — | Os números conectados |

E não é só leitura: testei `DELETE` e `UPDATE` com a chave anônima e os dois
foram aceitos. Qualquer pessoa poderia apagar tudo.

As tabelas do ZapCRM **não** têm esse problema — conferi, a RLS delas barra a
chave anônima corretamente. É só a Evolution.

### O conserto

**Onde:** Supabase → SQL Editor → colar → Run

```sql
do $$
declare t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in (
        'profiles', 'instances', 'etiquetas', 'contatos',
        'midias', 'disparos', 'disparo_envios', 'mensagens'
      )
  loop
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
```

Isso tira o acesso dos dois papéis que a API REST usa. **A Evolution continua
funcionando normalmente** — ela conecta direto no Postgres com outro usuário,
não pela API REST.

### Confirmar que fechou

No SQL Editor:

```sql
select tablename,
       has_table_privilege('anon', 'public.' || quote_ident(tablename), 'SELECT') as anon_le
from pg_tables
where schemaname = 'public'
order by anon_le desc, tablename;
```

Todas as tabelas da Evolution devem aparecer com `anon_le` em `false`. As oito
do ZapCRM podem continuar `true` — elas são protegidas por RLS, que é outra
camada.

Depois disso, abra o app e confira que Mensagens, Contatos e Conexão seguem
funcionando.

> Se um dia você atualizar a Evolution e ela criar tabelas novas, rode o mesmo
> bloco outra vez.

---

## Passo 1 — Rodar a migration 0009

**Onde:** Supabase → SQL Editor

Deixa a segurança das tabelas mais barata e indexa as chaves estrangeiras.
Roda em segundos e não apaga nada. O arquivo completo está em
`supabase/migrations/0009_desempenho.sql` — cole o conteúdo dele.

**Como saber que deu certo:** abra Contatos, Mensagens e Disparos no app.
Vendo os dados normalmente, está certo.

---

## Passo 2 — Medir o banco

A consulta que eu tinha passado quebrava: ela montava o nome da tabela como
texto, e os nomes da Evolution têm maiúsculas (`"Message"`), que o Postgres
rebaixa para minúsculas sem aspas. Esta usa o identificador interno e não tem
esse problema:

```sql
select
  n.nspname as schema,
  pg_size_pretty(sum(pg_total_relation_size(c.oid))) as tamanho
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
group by n.nspname
order by sum(pg_total_relation_size(c.oid)) desc;
```

E as maiores tabelas:

```sql
select
  n.nspname || '.' || c.relname as tabela,
  pg_size_pretty(pg_total_relation_size(c.oid)) as tamanho
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_total_relation_size(c.oid) desc
limit 15;
```

Guarde o resultado para comparar depois do passo 4.

**A resposta da sua pergunta original já está clara:** 150 mil mensagens no
banco é o que consome a memória.

---

## Passo 3 — Desligar o que a Evolution guarda à toa

**Onde:** Render → serviço `evolution-api` → Environment

Mude **estas quatro** para `false`:

```
DATABASE_SAVE_DATA_CONTACTS    = false
DATABASE_SAVE_DATA_CHATS       = false
DATABASE_SAVE_DATA_LABELS      = false
DATABASE_SAVE_DATA_HISTORIC    = false
```

Se `LABELS` ou `HISTORIC` não existirem, crie.

**Não mexa nestas três:**

```
DATABASE_SAVE_DATA_INSTANCE      = true   ← guarda a sessão do WhatsApp
DATABASE_SAVE_DATA_NEW_MESSAGE   = true   ← ver o passo 5
DATABASE_SAVE_MESSAGE_UPDATE     = true   ← ver o passo 5
```

Clique em **Save** e o Render reinicia sozinho.

Nada disso afeta o app: nenhuma tela lê as tabelas da Evolution. Mensagens e
Contatos leem tabelas próprias, e o status de conexão é uma chamada ao vivo.

---

## Passo 4 — Limpar as 150 mil linhas

**Só depois do passo 3, com o serviço já reiniciado** — senão ela volta a
encher enquanto você limpa.

```sql
truncate table public."Message" restart identity cascade;
truncate table public."MessageUpdate" restart identity cascade;
truncate table public."Chat" restart identity cascade;
truncate table public."Contact" restart identity cascade;
truncate table public."Label" restart identity cascade;
```

As aspas nos nomes são obrigatórias. Se alguma tabela não existir, apague a
linha dela e rode o resto.

⚠️ **Não apague `public."Session"` nem `public."Instance"`** — são elas que
guardam a sessão do WhatsApp conectado. Apagando, o QR precisa ser lido de
novo.

Rode o passo 2 outra vez para ver o quanto liberou.

---

## Passo 5 — Opcional: testar as duas variáveis de mensagem

`DATABASE_SAVE_MESSAGE_UPDATE` é o maior gerador de linhas: cria uma para cada
mudança de status de cada mensagem. Mas não confirmei se desligá-la também
silencia o webhook, que é de onde a aba de Mensagens se alimenta.

1. No Render, mude as duas para `false` e salve.
2. Mande uma mensagem de outro celular para o número conectado.
3. Abra a aba **Mensagens** no app.

- **Apareceu** → pode deixar desligado.
- **Não apareceu** → volte as duas para `true`. Nada se perde.

---

## Opcional — envio automático dos disparos agendados

Hoje o disparo sai pelo botão **"Enviar agora"**. Para o agendamento funcionar
sozinho, crie um job no cron-job.org, a cada 1 minuto:

```
https://SUA-URL.vercel.app/api/disparos/processar?chave=SEU_WEBHOOK_SECRET
```

---

## Depois: separar a Evolution do schema public

O passo 0 fecha o buraco, mas a causa é a Evolution dividir o schema `public`
com o app. O certo é ela ter o próprio schema, que a API REST não publica —
era essa a intenção do plano original, e não foi o que aconteceu na prática.

Envolve mover as tabelas e apontar a `DATABASE_CONNECTION_URI` para o schema
novo, com risco de a sessão se perder no caminho. Vale fazer com calma, não
agora. Me avise quando quiser e eu preparo o passo a passo.
