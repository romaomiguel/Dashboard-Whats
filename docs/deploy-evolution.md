# Subindo a Evolution API no Render

## 1. Criar o projeto no Supabase

Em supabase.com, criar projeto. Anotar de Settings > API:
`Project URL`, `anon key`, `service_role key`.
De Settings > Database, anotar a **Connection string** (modo Session, porta 5432).

## 2. Criar o serviço no Render

Em render.com: New > Web Service > Existing image.
Imagem: `docker.io/atendai/evolution-api:v2.2.3`. Plano: Free.

Variáveis: copiar as do `render.yaml`. Preencher à mão:
- `DATABASE_CONNECTION_URI` — a connection string do Supabase
- `SERVER_URL` — a URL que o Render der, ex `https://evolution-api-xxxx.onrender.com`
- `AUTHENTICATION_API_KEY` — gerar com `openssl rand -hex 24` e **guardar**

## 3. Verificar

    curl -s https://SEU-SERVICO.onrender.com/ | head

Deve responder JSON com nome e versão da API. Se demorar ~1 min, é o
spin-down: o plano free desliga após 15 min sem tráfego.

## 4. Manter acordado

O spin-down derruba a sessão do WhatsApp. Cadastrar em cron-job.org ou
UptimeRobot (gratuitos) um GET na raiz a cada 10 minutos.

Isso consome quase toda a cota de 750 horas/mês do plano free — suficiente
para um serviço, sem folga.

## 5. Preencher o `.env` local

    EVOLUTION_API_URL=https://SEU-SERVICO.onrender.com
    EVOLUTION_API_KEY=<a AUTHENTICATION_API_KEY do passo 2>

## Limites conhecidos do plano free

- **512 MB de RAM.** Cada sessão do WhatsApp consome 150–300 MB, o que
  comporta uma a duas instâncias. Com três, o serviço reinicia por falta
  de memória.
- **Sem disco persistente.** Por isso `DATABASE_SAVE_DATA_INSTANCE=true`
  e o banco no Supabase: as credenciais das sessões sobrevivem a restart.
- Render Starter (~US$ 7/mês) remove o spin-down; Standard (~US$ 25/mês)
  dá 2 GB. Nenhum dos dois exige mudança de código.
