-- Etapas do funil, ordenadas.
--
-- Separadas de `etiquetas` de propósito: etiqueta classifica livremente (um
-- contato pode ser "VIP" sem que isso tenha ordem), etapa é posição única no
-- funil e tem sequência. Na mesma tabela não daria para responder "quanto
-- tempo ficou em Negociando".
create table public.etapas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  nome       text not null,
  ordem      integer not null,
  criado_em  timestamptz not null default now(),
  constraint nome_etapa_valido check (length(trim(nome)) between 1 and 24),
  constraint etapa_unica_por_usuario unique (owner_id, nome)
);

create index etapas_owner_idx on public.etapas (owner_id, ordem);

-- Etapa apagada devolve o contato para "sem etapa" em vez de apagá-lo, como
-- já acontece com etiqueta.
alter table public.contatos
  add column etapa_id uuid references public.etapas(id) on delete set null;

create index contatos_etapa_idx on public.contatos (etapa_id);

-- Histórico de movimentação: é o que permite medir tempo em cada etapa e
-- taxa de avanço. Sem FK para etapas com cascade, senão renomear ou apagar
-- uma etapa apagaria o passado junto — o nome fica congelado no texto.
create table public.contato_etapa_historico (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  contato_id  uuid not null references public.contatos(id) on delete cascade,
  de          text,
  para        text not null,
  criado_em   timestamptz not null default now()
);

create index historico_contato_idx
  on public.contato_etapa_historico (owner_id, contato_id, criado_em desc);

alter table public.etapas enable row level security;
alter table public.contato_etapa_historico enable row level security;

create policy propria_etapa on public.etapas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy proprio_historico on public.contato_etapa_historico
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
