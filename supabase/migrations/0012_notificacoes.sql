create type public.notificacao_tipo as enum ('mensagem', 'disparo', 'conexao');

create table public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  tipo           public.notificacao_tipo not null,
  -- Agrupa: 'mensagem:5565984627628', 'disparo:<uuid>', 'conexao:<uuid>'.
  chave          text not null,
  titulo         text not null,
  corpo          text,
  destino        text,
  lida           boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint titulo_valido check (length(trim(titulo)) between 1 and 120),
  -- Restrição completa, não índice parcial: só assim o ON CONFLICT a infere.
  constraint notificacao_unica_por_dono unique (owner_id, chave)
);

-- Corrigido pela 0013: com `lida` no meio da chave, o Postgres agrupa por
-- lida antes de ordenar por atualizado_em, e a listagem do sino não filtra
-- por lida — não satisfazia o `order by` dela. A 0013 derruba este índice e
-- cria (owner_id, atualizado_em desc), que serve a listagem e ainda cobre a
-- retenção pelo prefixo do dono mais a faixa de data.
create index notificacoes_sino_idx
  on public.notificacoes (owner_id, lida, atualizado_em desc);

alter table public.notificacoes enable row level security;

create policy propria_notificacao on public.notificacoes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Sem isto o canal de Realtime conecta e nunca recebe nada.
alter publication supabase_realtime add table public.notificacoes;

alter table public.profiles
  add column notificar_mensagem boolean not null default true,
  add column notificar_disparo  boolean not null default true,
  add column notificar_conexao  boolean not null default true;
