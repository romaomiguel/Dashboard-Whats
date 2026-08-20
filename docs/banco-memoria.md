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

### Desligar agora — verificado

Nenhuma tela do ZapCRM lê o schema da Evolution. Conferido no código: a aba de
Mensagens lê `public.mensagens`, Contatos lê `public.contatos`, e o status de
conexão vem de uma chamada HTTP ao vivo em `/instance/connectionState`. Os
endpoints `findContacts`, `findChats` e `findMessages` estão definidos mas não
são chamados em lugar nenhum.

| Variável | Para | Porquê |
|---|---|---|
| `DATABASE_SAVE_DATA_INSTANCE` | **continua true** | Guarda a sessão. Sem ela, o QR precisaria ser lido a cada reinício |
| `DATABASE_SAVE_DATA_CONTACTS` | **false** | A agenda inteira do WhatsApp, que o app nunca lê |
| `DATABASE_SAVE_DATA_CHATS` | **false** | Todas as conversas, idem |
| `DATABASE_SAVE_DATA_LABELS` | **false** | Idem |
| `DATABASE_SAVE_DATA_HISTORIC` | **false** | O histórico antigo que o celular despeja ao conectar — provavelmente o maior volume de todos |

### Manter ligado por ora — não verificado

| Variável | Para | Porquê |
|---|---|---|
| `DATABASE_SAVE_DATA_NEW_MESSAGE` | **continua true** | Ver abaixo |
| `DATABASE_SAVE_MESSAGE_UPDATE` | **continua true** | Ver abaixo |

A aba de Mensagens depende do **webhook**, não do banco da Evolution: o que
chega é gravado em `public.mensagens` pelo receptor, e os recibos de entrega e
leitura vêm pelo evento `MESSAGES_UPDATE`. Em teoria as duas coisas são
independentes — persistir e emitir evento são caminhos separados.

Só que **não consegui confirmar isso no código da v2.3.7**: o repositório não
estava acessível para leitura e a documentação não cobre a interação. Sem essa
confirmação, desligar arrisca a aba de Mensagens parar de receber, e o espaço
economizado não compensa.

**Como testar, em dois minutos e reversível:**

1. Desligue as duas no painel do Render e reinicie o serviço.
2. Mande uma mensagem de outro celular para o número conectado.
3. Abra a aba de Mensagens.

Aparecendo a mensagem, pode deixar desligado — e aí some também o maior
gerador de linhas, que é uma por mudança de status de cada mensagem. Não
aparecendo, religue as duas: a perda é só de espaço.

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
