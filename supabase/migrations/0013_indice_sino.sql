-- A 0012 criou (owner_id, lida, atualizado_em desc): com `lida` no meio da
-- chave, o B-tree agrupa por lida antes de ordenar por data, e
-- listarNotificacoes não filtra por lida — o `order by atualizado_em desc`
-- não era satisfeito pelo índice, precisava ordenar depois.
--
-- Um índice só, sem `lida`: serve a listagem (caminho quente, roda a cada
-- navegação porque o sino vive no layout) e ainda serve a retenção, pelo
-- prefixo do dono mais a faixa de atualizado_em, filtrando lida fora do
-- índice.
drop index public.notificacoes_sino_idx;

create index notificacoes_sino_idx
  on public.notificacoes (owner_id, atualizado_em desc);
