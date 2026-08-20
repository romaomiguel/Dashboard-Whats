-- Etiquetas de contato, cadastradas pelo próprio usuário em Configurações.
-- Cores são um enum para que a interface tenha um conjunto fechado de estilos
-- e ninguém consiga gravar uma classe arbitrária de CSS pelo formulário.
create type public.etiqueta_cor as enum (
  'verde', 'azul', 'ambar', 'roxo', 'rosa', 'cinza'
);

create table public.etiquetas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  nome       text not null,
  cor        public.etiqueta_cor not null default 'cinza',
  criado_em  timestamptz not null default now(),
  constraint nome_nao_vazio check (length(trim(nome)) between 1 and 24),
  constraint etiqueta_unica_por_usuario unique (owner_id, nome)
);

create index etiquetas_owner_idx on public.etiquetas (owner_id);

alter table public.etiquetas enable row level security;

create policy propria_etiqueta on public.etiquetas
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
