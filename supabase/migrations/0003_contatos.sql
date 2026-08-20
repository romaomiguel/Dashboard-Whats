-- Contatos do usuário. A etiqueta é referência, não texto solto: renomear
-- uma etiqueta não deixa contato órfão com o nome antigo, e apagá-la só
-- desclassifica o contato em vez de derrubá-lo junto.
create table public.contatos (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  nome           text not null,
  numero         text not null,
  etiqueta_id    uuid references public.etiquetas(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint nome_contato_valido check (length(trim(nome)) between 1 and 120),
  constraint numero_valido check (length(trim(numero)) between 1 and 32),
  constraint contato_unico_por_usuario unique (owner_id, numero)
);

create index contatos_owner_idx on public.contatos (owner_id);
create index contatos_etiqueta_idx on public.contatos (etiqueta_id);

alter table public.contatos enable row level security;

create policy proprio_contato on public.contatos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
