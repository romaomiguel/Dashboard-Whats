-- Uma linha por mensagem do WhatsApp.
--
-- O disparo grava a mensagem quando o envio retorna, e o webhook também vai
-- passar a gravar o que sai pelo celular. Os dois podem falar da mesma
-- mensagem, e o índice único é o que garante que ela não entre duas vezes,
-- mesmo se os dois chegarem juntos.
create unique index mensagens_key_unica
  on public.mensagens (mensagem_key)
  where mensagem_key is not null;

-- O índice não único de antes vira redundante.
drop index if exists public.mensagens_key_idx;
