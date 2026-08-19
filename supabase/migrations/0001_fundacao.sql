-- Perfis: espelho de auth.users com dados do app
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  criado_em  timestamptz not null default now()
);

create type public.instance_status as enum (
  'criada', 'conectando', 'conectada', 'desconectada'
);

-- Uma instância da Evolution por usuário
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

create index instances_owner_idx on public.instances (owner_id);

alter table public.profiles  enable row level security;
alter table public.instances enable row level security;

create policy proprio_perfil on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy propria_instancia on public.instances
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Cria o perfil automaticamente quando a conta nasce no painel do Supabase
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
