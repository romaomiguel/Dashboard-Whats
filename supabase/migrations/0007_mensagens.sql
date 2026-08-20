create type public.mensagem_direcao as enum ('saida', 'entrada');

create type public.mensagem_status as enum ('enviada', 'falhou', 'recebida');

-- Histórico de conversa. Alimentado pelo disparo, na saída, e pelo webhook da
-- Evolution, na entrada — as duas pontas na mesma tabela para a tela de
-- Mensagens poder montar a conversa em ordem.
create table public.mensagens (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  instance_id  uuid references public.instances(id) on delete set null,
  disparo_id   uuid references public.disparos(id) on delete set null,
  numero       text not null,
  nome         text,
  direcao      public.mensagem_direcao not null,
  status       public.mensagem_status not null,
  texto        text not null,
  erro         text,
  criado_em    timestamptz not null default now()
);

create index mensagens_owner_idx on public.mensagens (owner_id, criado_em desc);
-- A tela agrupa por número: este índice serve a busca da última de cada um.
create index mensagens_conversa_idx on public.mensagens (owner_id, numero, criado_em desc);

alter table public.mensagens enable row level security;

create policy propria_mensagem on public.mensagens
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
