-- Confirmação de entrega e de leitura.
--
-- Sem isto o funil da Home só saberia "a API aceitou" — chamar aquilo de
-- "entregue" seria mentira. A Evolution avisa os dois estados pelo evento
-- MESSAGES_UPDATE, e o casamento é pelo id da mensagem.
alter type public.mensagem_status add value if not exists 'entregue';
alter type public.mensagem_status add value if not exists 'lida';

alter table public.mensagens add column mensagem_key text;

-- O webhook chega com o id e precisa achar a linha por ele.
create index mensagens_key_idx on public.mensagens (mensagem_key)
  where mensagem_key is not null;
