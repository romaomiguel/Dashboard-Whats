-- Mais de uma conexão por usuário. A restrição de uma só vinha da Entrega 1,
-- quando o escopo era conectar um aparelho; a operação real usa vários
-- números (comercial, suporte, financeiro).
alter table public.instances drop constraint uma_instancia_por_usuario;

-- Nome que o usuário dá à conexão. O evolution_name continua opaco, porque
-- ele aparece em log da Evolution; este aqui é o rótulo da tela.
alter table public.instances add column nome text not null default 'Conexão';
alter table public.instances alter column nome drop default;

alter table public.instances add constraint nome_conexao_valido
  check (length(trim(nome)) between 1 and 40);

-- Dois aparelhos com o mesmo rótulo tornariam a tela de disparo ambígua.
alter table public.instances add constraint nome_unico_por_usuario
  unique (owner_id, nome);
