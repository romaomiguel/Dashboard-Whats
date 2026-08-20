-- Ajustes de desempenho do banco. Duas frentes: RLS reavaliada por linha e
-- chave estrangeira sem índice.

-- ── 1. auth.uid() dentro de select ──────────────────────────────────────────
--
-- Escrito como `owner_id = auth.uid()`, o Postgres trata auth.uid() como
-- volátil e chama a função uma vez por linha examinada. Dentro de um select
-- ela vira InitPlan: avaliada uma vez e reaproveitada. A diferença cresce com
-- o tamanho da tabela.
--
-- `to authenticated` também poupa trabalho: sem isso a policy é considerada
-- até para o papel anon, que nunca deveria ver nada.

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

-- As do storage seguem a mesma regra.
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

-- ── 2. Chave estrangeira sem índice ─────────────────────────────────────────
--
-- O Postgres não indexa FK sozinho. Sem índice, apagar o pai obriga a varrer
-- o filho inteiro com a tabela travada — foi o que fez a remoção de uma
-- conexão demorar mais de trinta segundos.

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

-- Estatística fresca depois de mexer em índice.
analyze public.disparos;
analyze public.disparo_envios;
analyze public.mensagens;
