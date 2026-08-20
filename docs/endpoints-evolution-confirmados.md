# Endpoints da Evolution — Confirmados

**Versão da API:** 2.3.7  
**Data da confirmação:** 2026-08-19  
**Ambiente:** Instância produção do usuário

## Nota importante

A documentação do Evolution Foundation cita `/webhook/instance` como rota para configurar webhooks. **Esta rota não existe na versão 2.3.7.** A rota correta é `POST /webhook/set/{instance}`, conforme confirmado abaixo.

## Tabela de endpoints

| Método | Caminho | Código HTTP | Descrição | Recorte da resposta |
|--------|---------|-------------|-----------|---------------------|
| `POST` | `/instance/create` | 200 | Criar nova instância WhatsApp | `{"instance":{"instanceName","instanceId","integration","status":"close"},"hash":"<STRING>","webhook":{},"settings":{...}}` |
| `GET` | `/instance/connectionState/{instance}` | 200 | Verificar estado da conexão | `{"instance":{"instanceName","state":"close"}}` |
| `POST` | `/webhook/set/{instance}` | 201 | Configurar webhook para instância | Status 201 (sucesso) |
| `POST` | `/webhook/instance` | 404 | ~~Configurar webhook (rota alternativa)~~ | Não existe — retorna 404 |
| `GET` | `/webhook/find/{instance}` | 200 | Recuperar configuração de webhook | Retorna a config gravada |
| `DELETE` | `/instance/delete/{instance}` | 200 | Deletar instância | Status 200 (sucesso); repetido → 404 |
| `DELETE` | `/instance/logout/{instance}` | 400 | Logout de instância desconectada | Status 400 (não 404) |
| `GET` | `/instance/fetchInstances` | 200 ou 401 | Listar instâncias | `[]` (com apikey correta) ou 401 (apikey errada) |

## Implicações para a implementação

- O receptor de webhook (`app/api/webhooks/evolution/[segredo]/route.ts`) assume que a Evolution irá fazer POST para `/api/webhooks/evolution/<WEBHOOK_SECRET>` com eventos do tipo `EventoWebhook`.
- A configuração do webhook é feita via `POST /webhook/set/{instance}` (não `/webhook/instance`).
- Respostas de webhook devem ser 200 rápido, pois a Evolution reenvia eventos que não recebem 2xx.
