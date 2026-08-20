# Memória do Postgres — diagnóstico e ajustes

## O que foi medido

As tabelas do ZapCRM somam **10 linhas** no total. Elas não têm como causar
pressão de memória:

| Tabela | Linhas |
|---|---|
| profiles | 3 |
| instances | 1 |
| etiquetas | 2 |
| contatos | 1 |
| midias | 0 |
| disparos | 1 |
| disparo_envios | 1 |
| mensagens | 1 |

O suspeito é a **Evolution API**, que usa o mesmo Postgres (schema `evolution`,
configurado por `DATABASE_CONNECTION_URI`) e vinha com toda a persistência
ligada.

## 1. Confirmar de onde vem o peso

Rode no SQL Editor do Supabase:

```sql
-- Tamanho por schema
select
  schemaname,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))) as tamanho
from pg_tables
where schemaname not in ('pg_catalog', 'information_schema')
group by schemaname
order by sum(pg_total_relation_size(schemaname||'.'||tablename)) desc;

-- As dez maiores tabelas
select
  schemaname || '.' || relname as tabela,
  n_live_tup as linhas,
  pg_size_pretty(pg_total_relation_size(relid)) as tamanho
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 10;
```

Se `evolution` aparecer com dezenas ou centenas de MB e o `public` com alguns
KB, a conclusão está confirmada.

## 2. Parar de acumular

O `render.yaml` já traz a configuração corrigida, mas o Render lê as variáveis
do painel, não do arquivo — **as mudanças precisam ser feitas lá também**, em
Environment, e o serviço reiniciado:

| Variável | Antes | Agora | Porquê |
|---|---|---|---|
| `DATABASE_SAVE_DATA_INSTANCE` | true | **true** | Mantém a sessão entre reinícios; sem ela o QR teria de ser lido a cada deploy |
| `DATABASE_SAVE_DATA_NEW_MESSAGE` | true | **false** | O ZapCRM guarda a própria cópia em `public.mensagens` |
| `DATABASE_SAVE_MESSAGE_UPDATE` | true | **false** | Gera várias linhas por mensagem, uma por mudança de status |
| `DATABASE_SAVE_DATA_CONTACTS` | true | **false** | A agenda inteira do WhatsApp, que o app não lê |
| `DATABASE_SAVE_DATA_CHATS` | true | **false** | Todas as conversas, idem |
| `DATABASE_SAVE_DATA_LABELS` | — | **false** | Idem |
| `DATABASE_SAVE_DATA_HISTORIC` | — | **false** | Histórico antigo sincronizado na conexão |

Desligar isso **não afeta o webhook**: a Evolution continua entregando os
eventos, inclusive os recibos de entrega e leitura que alimentam o funil da
Home. O que muda é ela parar de arquivar o que ninguém consulta.

## 3. Limpar o que já foi acumulado

Só depois de conferir o passo 1 e com o serviço já reiniciado com a
configuração nova. **Não apague a tabela de instâncias** — é ela que guarda a
sessão do WhatsApp conectado.

```sql
-- Confira antes o que existe e o tamanho de cada uma
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
from pg_stat_user_tables
where schemaname = 'evolution'
order by pg_total_relation_size(relid) desc;
```

Havendo tabelas grandes de mensagem, chat, contato ou label, o esvaziamento é:

```sql
-- Ajuste os nomes ao que o passo anterior mostrou.
truncate table evolution."Message" restart identity cascade;
truncate table evolution."MessageUpdate" restart identity cascade;
truncate table evolution."Chat" restart identity cascade;
truncate table evolution."Contact" restart identity cascade;
truncate table evolution."Label" restart identity cascade;
```

`truncate` devolve o espaço na hora, sem precisar de `vacuum full`.

Se preferir não apagar, dá para manter só o recente:

```sql
delete from evolution."Message"
where "messageTimestamp" < extract(epoch from now() - interval '7 days');
```

## 4. O que foi corrigido no schema do ZapCRM

Na migration `0009_desempenho.sql`:

- **RLS reavaliada por linha.** Todas as policies usavam `auth.uid()` direto.
  Assim o Postgres chama a função uma vez por linha examinada; dentro de um
  `select` ela é avaliada uma vez só. Também ganharam `to authenticated`, para
  não serem consideradas para o papel anônimo.
- **Chave estrangeira sem índice.** `disparos.instance_id`,
  `disparos.etiqueta_id`, `disparo_envios.owner_id`, `mensagens.instance_id` e
  `mensagens.disparo_id` não tinham índice. Sem ele, apagar o pai obriga a
  varrer o filho inteiro com a tabela travada — foi o que fez a remoção de uma
  conexão passar de trinta segundos durante os testes.

Com dez linhas isso não muda nada hoje. Muda quando a base crescer, e sai mais
barato acertar agora do que descobrir sob carga.
