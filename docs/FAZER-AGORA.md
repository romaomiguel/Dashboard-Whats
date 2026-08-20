# O que fazer agora

Quatro passos. As migrations de 0001 a 0008 já estão aplicadas — conferido no
banco. Falta só a 0009 e a configuração do Render.

---

## Passo 1 — Rodar a migration 0009

**Onde:** Supabase → SQL Editor → New query → colar → Run

Deixa a segurança das tabelas mais barata e indexa as chaves estrangeiras.
Roda em segundos e não apaga nada.

```sql
drop policy if exists proprio_perfil on public.profiles;
create policy proprio_perfil on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists propria_instancia on public.instances;
create policy propria_instancia on public.instances
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists propria_etiqueta on public.etiquetas;
create policy propria_etiqueta on public.etiquetas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists proprio_contato on public.contatos;
create policy proprio_contato on public.contatos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists propria_midia on public.midias;
create policy propria_midia on public.midias
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists proprio_disparo on public.disparos;
create policy proprio_disparo on public.disparos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists proprio_envio on public.disparo_envios;
create policy proprio_envio on public.disparo_envios
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists propria_mensagem on public.mensagens;
create policy propria_mensagem on public.mensagens
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists midia_propria_leitura on storage.objects;
create policy midia_propria_leitura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'midias'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists midia_propria_escrita on storage.objects;
create policy midia_propria_escrita on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'midias'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists midia_propria_exclusao on storage.objects;
create policy midia_propria_exclusao on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'midias'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create index if not exists disparos_instance_idx
  on public.disparos (instance_id);

create index if not exists disparos_etiqueta_idx
  on public.disparos (etiqueta_id)
  where etiqueta_id is not null;

create index if not exists envios_owner_idx
  on public.disparo_envios (owner_id);

create index if not exists mensagens_instance_idx
  on public.mensagens (instance_id)
  where instance_id is not null;

create index if not exists mensagens_disparo_idx
  on public.mensagens (disparo_id)
  where disparo_id is not null;

analyze public.disparos;
analyze public.disparo_envios;
analyze public.mensagens;
```

**Como saber que deu certo:** entre no app e abra Contatos, Mensagens e
Disparos. Vendo os dados normalmente, está certo. Se algo aparecer vazio,
avise — é sinal de que uma policy ficou apertada demais.

---

## Passo 2 — Ver de onde vem o peso no banco

**Onde:** Supabase → SQL Editor

```sql
select
  schemaname,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))) as tamanho
from pg_tables
where schemaname not in ('pg_catalog', 'information_schema')
group by schemaname
order by sum(pg_total_relation_size(schemaname||'.'||tablename)) desc;
```

Guarde o resultado. O esperado é `evolution` com muitos MB e `public` com
poucos KB — as tabelas do app somam 10 linhas no total.

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

Se `LABELS` ou `HISTORIC` não existirem na lista, crie.

**Não mexa nestas três:**

```
DATABASE_SAVE_DATA_INSTANCE      = true   ← guarda a sessão do WhatsApp
DATABASE_SAVE_DATA_NEW_MESSAGE   = true   ← ver o passo 5
DATABASE_SAVE_MESSAGE_UPDATE     = true   ← ver o passo 5
```

Depois clique em **Save**, e o Render reinicia sozinho.

**Nada disso afeta o app:** nenhuma tela lê o banco da Evolution. Mensagens e
Contatos leem tabelas próprias, e o status de conexão é uma chamada ao vivo.

---

## Passo 4 — Limpar o que já ficou acumulado

**Só depois do passo 3, com o serviço já reiniciado.**

Primeiro veja o que existe:

```sql
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
from pg_stat_user_tables
where schemaname = 'evolution'
order by pg_total_relation_size(relid) desc;
```

Depois esvazie **só** as que apareceram grandes, ajustando os nomes:

```sql
truncate table evolution."Message" restart identity cascade;
truncate table evolution."MessageUpdate" restart identity cascade;
truncate table evolution."Chat" restart identity cascade;
truncate table evolution."Contact" restart identity cascade;
truncate table evolution."Label" restart identity cascade;
```

⚠️ **Não apague a tabela de instâncias da Evolution** — é ela que guarda a
sessão do WhatsApp conectado. Apagando, o QR precisa ser lido de novo.

Rode o passo 2 outra vez para comparar.

---

## Passo 5 — Opcional: testar as duas variáveis de mensagem

Só se quiser economizar mais. É reversível.

`DATABASE_SAVE_MESSAGE_UPDATE` é o maior gerador de linhas do banco: cria uma
para cada mudança de status de cada mensagem. Mas não confirmei se desligá-la
também silencia o webhook, que é de onde a aba de Mensagens se alimenta.

1. No Render, mude as duas para `false` e salve.
2. Mande uma mensagem de outro celular para o número conectado.
3. Abra a aba **Mensagens** no app.

- **Apareceu** → pode deixar desligado.
- **Não apareceu** → volte as duas para `true` e salve. Nada se perde.

---

## Opcional — envio automático dos disparos agendados

Hoje o disparo sai pelo botão **"Enviar agora"**. Para o agendamento
funcionar sozinho, crie um job no cron-job.org, a cada 1 minuto:

```
https://SUA-URL.vercel.app/api/disparos/processar?chave=SEU_WEBHOOK_SECRET
```

O `SEU_WEBHOOK_SECRET` é o mesmo valor que está no `.env` e na Vercel.
