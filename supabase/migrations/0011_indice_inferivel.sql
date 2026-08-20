-- Índice único que o ON CONFLICT consegue enxergar.
--
-- A 0010 criou um índice parcial ("where mensagem_key is not null"), e o
-- Postgres só o infere no ON CONFLICT se a instrução repetir a mesma condição
-- — coisa que a API REST não faz. O resultado era erro 42P10 em toda gravação
-- do webhook, e nenhuma mensagem entrava.
--
-- Sem a condição, o índice serve para inferência. Vários NULL continuam
-- permitidos: por padrão o Postgres trata NULL como distinto de NULL, então
-- mensagem sem chave não colide com outra sem chave.
drop index if exists public.mensagens_key_unica;

create unique index mensagens_key_unica
  on public.mensagens (mensagem_key);

-- Remover a conexão passa a levar as conversas dela junto.
--
-- Antes o vínculo apenas virava nulo, e as mensagens continuavam na tela sem
-- pertencer a conexão nenhuma. Elas só fazem sentido no contexto do aparelho
-- que as trocou: saindo ele, saem elas.
alter table public.mensagens
  drop constraint if exists mensagens_instance_id_fkey;

alter table public.mensagens
  add constraint mensagens_instance_id_fkey
  foreign key (instance_id) references public.instances(id) on delete cascade;

-- Limpa o que já ficou órfão de remoções anteriores.
delete from public.mensagens where instance_id is null;
