# Esteira por conversa — design

**Data:** 2026-08-21
**Origem:** `implementation.txt`, revisão do usuário depois de usar a esteira entregue pelo plano `2026-08-21-chat-e-esteira.md`.

## O problema

A esteira entregue funciona, mas o uso real expôs três coisas:

1. **Com muitos contatos não dá para achar ninguém.** O quadro despeja todos os cards e cresce sem limite.
2. **A esteira mostra a agenda inteira, não o funil.** Ela lê `contatos`, então todo mundo que você cadastrou ou importou aparece — inclusive quem nunca trocou uma mensagem. E o inverso: quem te manda mensagem sem estar no cadastro nunca aparece. A coluna "Sem etapa" existe só para acomodar essa confusão.
3. **Mover exige achar o `<select>` do card.** O usuário quer pegar o card e arrastar.

## As decisões

### 1. A unidade do funil passa a ser a conversa, não o contato

**Escolhido.** Uma tabela nova, `funil`, com uma linha por conversa: `(owner_id, chave_numero)`.

A alternativa considerada era manter o contato como unidade e fazer o webhook criar contatos para números desconhecidos. Foi recusada por um motivo concreto: `contatos` é único por `(owner_id, numero)` **cru**, e as duas pontas do sistema gravam formas diferentes do mesmo número — o cadastro e o CSV escrevem `5565984627628` (com o nono dígito), o webhook escreve `556584627628` (sem). Criar contato pelo webhook duplicaria o mesmo cliente: dois cards no funil, duas linhas em Contatos. Consertar isso exigiria uma coluna canônica em `contatos`, um índice único novo e uma varredura de duplicatas pré-existentes em dado de produção — risco desproporcional ao ganho.

A conversa como unidade evita tudo isso: `contatos` não muda, nada pode duplicar, e a esteira passa a responder exatamente a pergunta que o usuário fez — "quem tem conversa comigo". De quebra, a esteira e a tela de conversa passam a concordar sobre quem é quem; hoje usam chaves diferentes.

**Consequência:** `contatos.etapa_id` e `contato_etapa_historico`, criadas na 0014, ficam inalcançáveis e são removidas. Movimentações feitas durante o teste da 0014 se perdem. Aceito: a feature tem horas de vida.

### 2. O papel da etapa é marcado, não inferido

`etapas` ganha `papel`, que aceita `entrada`, `respondeu` ou nulo, no máximo um de cada por dono.

O funil padrão nasce com `Novo` = `entrada` e `Em conversa` = `respondeu`. Renomear a etapa não quebra a automação, porque ela não olha o nome. Apagar a etapa que carrega um papel apenas desliga aquela automação — não quebra nada e não apaga histórico.

Inferir pela ordem das colunas foi recusado: reordenar ou apagar uma coluna mudaria o significado das outras sem o usuário perceber.

### 3. A automação é de mão única

**Qualquer mensagem gravada — enviada ou recebida — inscreve a conversa no funil**, na etapa marcada `entrada`, se ela ainda não estiver lá. É isso que faz um disparo para 300 pessoas nascer como 300 cards em "Novo", que é o comportamento que o usuário descreveu.

**Só mensagem recebida promove.** Quando chega uma com `direcao = 'entrada'`:

- Se a linha do funil está na etapa `entrada`, move para a etapa `respondeu` e grava histórico com `automatico = true`.
- Se está em qualquer outra etapa, **não faz nada**.

A segunda regra é a que importa: sem ela, um cliente que você já levou para "Negociando" voltaria para "Em conversa" ao mandar qualquer mensagem, desfazendo seu trabalho. Daí em diante a movimentação é só manual, como o usuário pediu.

Cada mensagem também atualiza `funil.numero` para a forma vista naquela mensagem, para o card exibir e linkar um número que existe de fato.

Sem etapa marcada com o papel, a automação não faz nada — nunca inventa etapa.

### 4. Arrastar-e-soltar com `@dnd-kit`

`@dnd-kit/core` mais `@dnd-kit/sortable`, com os sensores de ponteiro, toque e teclado. O `<select>` por card sai.

O plano original recusou arrastar argumentando que quebra no toque e é inacessível por teclado. O argumento vale para arrastar feito na mão com HTML5; o `dnd-kit` existe justamente porque resolve os dois — Tab até o card, espaço para pegar, setas para mover, espaço para soltar. A dependência (~12kb) é o preço de não regredir em acessibilidade.

### 5. Localizar

- Campo de busca no topo, filtrando os cards de todas as colunas por nome e por número. A comparação de número é canônica, então achar por qualquer das duas formas funciona.
- Cada coluna com altura fixa, rolagem própria e contador no cabeçalho.

## Modelo de dados — migração 0015

```
funil
  id            uuid pk
  owner_id      uuid not null -> profiles(id) on delete cascade
  chave_numero  text not null          -- forma canônica, chaveDoNumero()
  numero        text not null          -- última forma vista, para exibir e linkar
  etapa_id      uuid -> etapas(id) on delete set null
  criado_em     timestamptz
  atualizado_em timestamptz
  unique (owner_id, chave_numero)

funil_historico
  id         uuid pk
  owner_id   uuid not null -> profiles(id) on delete cascade
  funil_id   uuid not null -> funil(id) on delete cascade
  de         text            -- nome da etapa, congelado
  para       text not null
  automatico boolean not null default false
  criado_em  timestamptz

etapas
  + papel text check (papel in ('entrada','respondeu'))
  + índice único parcial (owner_id, papel) where papel is not null

removidos
  contatos.etapa_id
  contato_etapa_historico
```

O histórico continua guardando o **nome** da etapa, não a referência — renomear ou apagar uma etapa não pode reescrever o passado. `automatico` distingue o que a automação fez do que o usuário fez, que é o que vai permitir explicar depois "por que este contato está aqui".

RLS por `owner_id` nas duas tabelas, no padrão de `0009_desempenho.sql`: `for all to authenticated using (owner_id = (select auth.uid()))`.

## Leitura

`listarEsteira()` passa a devolver etapas e linhas do funil. O nome exibido em cada card sai, nesta ordem:

1. `contatos.nome`, casando pela chave canônica
2. o último `mensagens.nome` não-nulo da conversa (o pushName do WhatsApp)
3. o próprio número

A reconciliação acontece em memória, como `listarConversas` já faz — o volume cabe, e é o padrão que o repositório escolheu.

Cada card leva ao `/mensagens/{numero}` da conversa.

## Escrita

- `moverContato` vira `moverNoFunil(funilId, etapaId)`, com checagem de dono na linha do funil **e** na etapa de destino.
- `criarEtapa`, `removerEtapa` seguem como estão, mais `definirPapel(etapaId, papel)`.
- "Criar funil padrão" passa a marcar os papéis junto: a primeira etapa criada recebe `entrada`, a segunda `respondeu`. Sem isso o funil padrão nasceria sem automação nenhuma.
- A automação do webhook roda com o cliente admin, depois da gravação da mensagem, e **nunca** derruba a requisição: falha nela é logada e engolida. O webhook existe para gravar mensagem; perder uma promoção de etapa é menos grave que perder a mensagem.
- O envio pela plataforma (`enviarMensagem`) inscreve pelo mesmo caminho, para responder alguém novo já criar o card.

## Verificação

Por instrução explícita do usuário, e para reduzir o número de passos:

- Cada passo roda **apenas o arquivo de teste que ele tocou**. Nada de suíte completa por passo, nada de `tsc` por passo.
- No fim, **uma verificação grande**: `npm run test:run`, `npx tsc --noEmit`, `npm run build`, e o roteiro manual.

Roteiro manual, ao final:

1. Rodar a 0015 no SQL Editor.
2. Mandar mensagem de um número que não está em Contatos → um card nasce em "Novo".
3. Responder por esse card e o contato responder de volta → o card vai sozinho para "Em conversa".
4. Arrastar o card para "Negociando" com o mouse; repetir com o teclado.
5. O contato manda outra mensagem → o card **continua** em "Negociando".
6. Buscar pelo número na outra forma do nono dígito → o card aparece.

## O que este design deliberadamente não faz

- **Não classifica por interesse ou engajamento.** Continua sendo o plano `2026-08-21-inteligencia-clientes.md`.
- **Não reordena etapas.** Arrastar move card entre colunas, não colunas entre si.
- **Não filtra por etiqueta.** Busca por texto resolve o problema relatado; filtro é escopo próprio.
- **Não mexe em `contatos`.** Nem coluna, nem índice, nem migração de dado.
- **Não remove ninguém do funil.** Não há saída automática; se precisar, o usuário apaga a etapa ou ignora o card.
