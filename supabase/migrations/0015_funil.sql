-- supabase/migrations/0015_funil.sql

-- Papel da etapa: o que a automação procura, em vez do nome.
--
-- Casar pelo texto "Em conversa" faria renomear a etapa quebrar a promoção
-- em silêncio. O papel acompanha a etapa, o nome é livre.
alter table public.etapas
  add column papel text
  constraint papel_valido check (papel in ('entrada', 'respondeu'));

-- Um papel por dono: duas etapas de entrada deixariam a automação escolher
-- ao acaso para onde mandar as conversas novas.
create unique index etapas_papel_unico
  on public.etapas (owner_id, papel)
  where papel is not null;

-- O funil passa a ser por conversa, não por contato.
--
-- `contatos` é único pelo número cru, e as duas pontas gravam formas
-- diferentes da mesma pessoa: o cadastro com o nono dígito, o webhook sem.
-- Inscrever pelo webhook na tabela de contatos duplicaria o cliente. A
-- chave canônica resolve, e faz a esteira e a tela de conversa concordarem
-- sobre quem é quem.
create table public.funil (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  chave_numero  text not null,
  numero        text not null,
  etapa_id      uuid references public.etapas(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint conversa_unica_por_usuario unique (owner_id, chave_numero)
);

create index funil_owner_idx on public.funil (owner_id, etapa_id);

-- Histórico com o nome da etapa congelado em texto: renomear ou apagar uma
-- etapa não pode reescrever o passado. `automatico` separa o que a
-- automação fez do que o usuário fez.
create table public.funil_historico (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  funil_id   uuid not null references public.funil(id) on delete cascade,
  de         text,
  para       text not null,
  automatico boolean not null default false,
  criado_em  timestamptz not null default now()
);

create index funil_historico_idx
  on public.funil_historico (owner_id, funil_id, criado_em desc);

alter table public.funil enable row level security;
alter table public.funil_historico enable row level security;

create policy proprio_funil on public.funil
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy proprio_funil_historico on public.funil_historico
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- A 0014 pendurou o funil no contato. Com a conversa como unidade estas
-- ficam inalcançáveis. O histórico gravado durante o teste da 0014 se perde
-- junto; aceito, a feature tem horas de vida.
drop table if exists public.contato_etapa_historico;
alter table public.contatos drop column if exists etapa_id;
