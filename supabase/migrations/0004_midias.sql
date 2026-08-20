-- Biblioteca de mídias. O arquivo em si vive no Storage; aqui fica só o
-- registro, para a listagem não depender de varrer o bucket.
create type public.midia_tipo as enum ('imagem', 'video', 'audio', 'documento');

create table public.midias (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  nome       text not null,
  tipo       public.midia_tipo not null,
  tamanho    bigint not null,
  caminho    text not null unique,
  legenda    text,
  criado_em  timestamptz not null default now(),
  constraint nome_midia_valido check (length(trim(nome)) between 1 and 200),
  constraint tamanho_valido check (tamanho > 0 and tamanho <= 16777216)
);

create index midias_owner_idx on public.midias (owner_id);

alter table public.midias enable row level security;

create policy propria_midia on public.midias
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Bucket privado: nada de arquivo de cliente exposto por URL adivinhável.
insert into storage.buckets (id, name, public, file_size_limit)
values ('midias', 'midias', false, 16777216)
on conflict (id) do nothing;

-- O caminho começa com o id do dono; a policy compara essa primeira pasta com
-- auth.uid(), então ninguém alcança a pasta de outro.
create policy midia_propria_leitura on storage.objects
  for select using (
    bucket_id = 'midias' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy midia_propria_escrita on storage.objects
  for insert with check (
    bucket_id = 'midias' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy midia_propria_exclusao on storage.objects
  for delete using (
    bucket_id = 'midias' and (storage.foldername(name))[1] = auth.uid()::text
  );
