create type public.disparo_status as enum (
  'agendado', 'enviando', 'concluido', 'cancelado'
);

create type public.envio_status as enum ('pendente', 'enviado', 'falhou');

create table public.disparos (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  nome           text not null,
  instance_id    uuid not null references public.instances(id) on delete cascade,
  -- null significa "todos os contatos"; etiqueta apagada volta a significar
  -- isso em vez de derrubar a campanha junto.
  etiqueta_id    uuid references public.etiquetas(id) on delete set null,
  mensagem       text not null,
  agendado_para  timestamptz not null,
  status         public.disparo_status not null default 'agendado',
  total          integer not null default 0,
  enviados       integer not null default 0,
  falhas         integer not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint nome_disparo_valido check (length(trim(nome)) between 1 and 60),
  constraint mensagem_valida check (length(trim(mensagem)) between 1 and 4096)
);

-- Destinatários congelados no momento da criação. Sem isso, mexer na base de
-- contatos depois mudaria para quem uma campanha já agendada seria enviada.
create table public.disparo_envios (
  id           uuid primary key default gen_random_uuid(),
  disparo_id   uuid not null references public.disparos(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  nome         text not null,
  numero       text not null,
  status       public.envio_status not null default 'pendente',
  erro         text,
  enviado_em   timestamptz,
  constraint um_envio_por_numero unique (disparo_id, numero)
);

create index disparos_owner_idx on public.disparos (owner_id);
-- O processador varre por aqui: pendentes cuja hora já chegou.
create index disparos_fila_idx on public.disparos (status, agendado_para);
create index envios_fila_idx on public.disparo_envios (disparo_id, status);

alter table public.disparos       enable row level security;
alter table public.disparo_envios enable row level security;

create policy proprio_disparo on public.disparos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy proprio_envio on public.disparo_envios
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
