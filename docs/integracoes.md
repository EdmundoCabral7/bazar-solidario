# Módulo de Integração — Bazar Solidário Digital

> Entrega 3 do Projeto de Extensão V (UNI-RN). Entidade **simulada**: Associação Patas Potiguares.
> Documentação interativa de todas as rotas: `GET /docs` (Swagger UI) · especificação: [`openapi.json`](openapi.json).

## Visão geral

| ID  | Sistema                  | Uso                                                | Modo `mock` (padrão)                     | Modo `sandbox` / real                             |
| --- | ------------------------ | -------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| I01 | **Mercado Pago**         | Pix, cartão, assinaturas (apadrinhamento), webhook | Gateway em memória + simulador           | SDK oficial `mercadopago` com credenciais `TEST-` |
| I02 | **Melhor Envio**         | Cotação de frete                                   | Tabela fixa por região                   | REST sandbox (`MELHORENVIO_TOKEN`)                |
| I03 | **ViaCEP**               | Endereço pelo CEP                                  | Endereços simulados (`VIACEP_MODE=mock`) | API pública real (padrão) com cache               |
| I04 | **WhatsApp Cloud API**   | Notificações                                       | Mensagem registrada no log               | Graph API (`WHATSAPP_TOKEN`)                      |
| I05 | **API pública do Bazar** | Parceiros consultam animais e campanhas            | —                                        | `/api/public/v1/*` com `x-api-key`                |

Cada integração implementa uma **interface** (`src/integrations/types.ts`): `PaymentProvider`,
`ShippingProvider`, `CepProvider`, `NotificationProvider`. O registro (`src/integrations/registry.ts`)
escolhe a implementação conforme `INTEGRATIONS_MODE` e as credenciais disponíveis. O restante do
sistema nunca sabe se está falando com o mock ou com o provedor real.

O projeto roda **do zero sem nenhuma conta externa**: `docker compose up -d` + `npm run dev`.

---

## I01 — Mercado Pago

### Fluxo de pagamento com webhook

```mermaid
sequenceDiagram
  autonumber
  participant P as Portal
  participant A as API
  participant DB as PostgreSQL
  participant MP as Mercado Pago
  participant W as Worker

  P->>A: POST /api/orders (Idempotency-Key)
  A->>DB: transação: reserva estoque + Order + Payment(PENDING) + Outbox(ORDER_CREATED)
  A->>MP: cria cobrança Pix (idempotencyKey, external_reference = Payment.id)
  MP-->>A: QR Code + copia-e-cola
  A-->>P: 201 pedido + Pix
  Note over P,MP: cliente paga no app do banco
  MP->>A: POST /api/webhooks/mercadopago (x-signature)
  A->>A: valida HMAC-SHA256
  A->>DB: INSERT WebhookEvent (provider, externalId) único
  A->>MP: GET /v1/payments/{id} (fonte da verdade)
  A->>DB: transação: UPDATE Payment WHERE status=PENDING → APPROVED; Order → PAID; Outbox(ORDER_PAID)
  A-->>MP: 200
  W->>DB: reserva lote da outbox (FOR UPDATE SKIP LOCKED)
  W->>W: envia WhatsApp/e-mail (retry com backoff)
```

### Endpoints

| Método | Rota                                  | Descrição                                                                         |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------- |
| POST   | `/api/orders`                         | Pedido do bazar + cobrança Pix/cartão                                             |
| POST   | `/api/donations`                      | Doação avulsa                                                                     |
| POST   | `/api/sponsorships`                   | Assinatura mensal (preapproval) — devolve `checkoutUrl`                           |
| POST   | `/api/sponsorships/{id}/cancel`       | Cancela assinatura (no gateway e localmente)                                      |
| POST   | `/api/webhooks/mercadopago`           | Webhook: `payment`, `subscription_preapproval`, `subscription_authorized_payment` |
| POST   | `/api/dev/payments/{id}/simulate`     | **Simulador** (mock): aprova/recusa um pagamento                                  |
| POST   | `/api/dev/sponsorships/{id}/simulate` | **Simulador** (mock): `AUTHORIZE`, `CHARGE`, `CANCEL`                             |

### Como testar em modo mock (sem conta)

```bash
# 1) pegue o id de uma peça
curl -s localhost:3333/api/products | jq -r '.data[0].id'

# 2) feche um pedido com Pix
curl -s -X POST localhost:3333/api/orders \
  -H 'content-type: application/json' -H 'Idempotency-Key: demo-pedido-0001' \
  -d '{"customer":{"name":"Maria","email":"maria@example.com","phone":"84999991234"},
       "items":[{"productId":"<ID>","quantity":1}],"delivery":{"type":"PICKUP"},
       "payment":{"method":"PIX"},"consent":true}'
# → anote "code" (PED-...) e "payment.id"

# 3) simule a aprovação (dispara o MESMO fluxo do webhook, com assinatura válida)
curl -s -X POST localhost:3333/api/dev/payments/<PAYMENT_ID>/simulate \
  -H 'content-type: application/json' -d '{"status":"APPROVED"}'

# 4) acompanhe
curl -s localhost:3333/api/orders/PED-XXXXXX | jq '.status, .payment.status'   # "PAID", "APPROVED"
```

Cartão no mock: qualquer `cardToken` aprova; `mock-card-rejected` recusa; `mock-card-pending` fica pendente.

### Como testar em sandbox

1. Crie uma aplicação em <https://www.mercadopago.com.br/developers/panel> e copie o **Access Token de teste** (`TEST-...`).
2. Em _Webhooks_, configure a URL `https://<sua-api>/api/webhooks/mercadopago` (eventos _Pagamentos_ e _Planos e assinaturas_) e copie a **assinatura secreta**.
3. No `.env`: `INTEGRATIONS_MODE=sandbox`, `MERCADOPAGO_ACCESS_TOKEN=TEST-...`, `MERCADOPAGO_WEBHOOK_SECRET=...`, `API_PUBLIC_URL=https://<sua-api>`.
4. Localmente, exponha a API com um túnel (ex.: `ngrok http 3333`) para receber webhooks.
5. Cartões de teste: <https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-cards>.

---

## I02 — Melhor Envio

| Método | Rota                  | Descrição                                    |
| ------ | --------------------- | -------------------------------------------- |
| POST   | `/api/shipping/quote` | Cotação para o carrinho (`{ cep, items[] }`) |

- **Mock** (`src/integrations/melhorenvio/mock.ts`): PAC/SEDEX com preço por região a partir de Natal
  (RN · Nordeste · demais) + adicional a cada 500 g.
- **Sandbox**: `POST https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate` com token OAuth2 pessoal
  (`MELHORENVIO_TOKEN`) e CEP de origem `MELHORENVIO_FROM_CEP`.
- O **frete é recalculado no servidor** ao fechar o pedido — o cliente envia só o nome do serviço escolhido.

## I03 — ViaCEP

| Método | Rota             | Descrição         |
| ------ | ---------------- | ----------------- |
| GET    | `/api/cep/{cep}` | Endereço pelo CEP |

API pública real (sem chave) com **cache em memória** de 24 h (CEP inexistente: 1 h) — ver contadores
`viacep.cache.hit/miss` em `/metrics`. Se o ViaCEP cair, o circuit breaker abre e a API responde
`503 CEP_SERVICE_UNAVAILABLE` (o portal deixa o usuário preencher o endereço manualmente).

## I04 — Notificações (WhatsApp / e-mail)

Notificações **nunca** são enviadas durante a requisição. A mudança de estado grava uma linha em
`NotificationOutbox` **na mesma transação** (padrão _transactional outbox_); o worker (`npm run worker`) envia depois.

| Template                                                                            | Quando              |
| ----------------------------------------------------------------------------------- | ------------------- |
| `ORDER_CREATED`, `ORDER_PAID`, `ORDER_SHIPPED`, `ORDER_DELIVERED`, `ORDER_CANCELED` | Pedido do bazar     |
| `DONATION_APPROVED`                                                                 | Doação confirmada   |
| `SPONSORSHIP_ACTIVE`, `SPONSORSHIP_CHARGED`, `SPONSORSHIP_CANCELED`                 | Apadrinhamento      |
| `ADOPTION_RECEIVED`, `ADOPTION_STATUS`                                              | Adoção              |
| `TICKET_CREATED`, `TICKET_UPDATED`                                                  | Central de serviços |

Canal: WhatsApp quando há telefone (convertido para E.164 `55DDDNUMERO`), senão e-mail. Sem
`WHATSAPP_TOKEN`, as mensagens aparecem no log do worker como `[mock WhatsApp] mensagem enviada`.

## I05 — API pública

Ver o guia para parceiros: [`api-publica.md`](api-publica.md).

---

## Requisitos não funcionais — onde estão no código

| Requisito                             | Implementação                                                                                                                          | Arquivo(s)                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Segurança — JWT**                   | Rotas internas exigem `Bearer`; papéis `ADMIN`, `VOLUNTEER`, `SUPPORT_N2`                                                              | `middlewares/auth.ts`                                    |
| **Segurança — assinatura do webhook** | HMAC-SHA256 do manifesto `id;request-id;ts`, comparação em tempo constante, tolerância anti-replay de 5 min em produção                | `integrations/mercadopago/signature.ts`                  |
| **Segurança — headers e CORS**        | `helmet` (CSP completa fora do `/docs`); CORS restrito a `CORS_ORIGIN`                                                                 | `app.ts`                                                 |
| **Segurança — chaves de parceiros**   | Guardadas só como hash SHA-256; exibidas uma única vez; revogáveis                                                                     | `middlewares/api-key.ts`, `modules/partners`             |
| **Segurança — valor do pagamento**    | Webhook consulta o gateway e recusa valor divergente (`AMOUNT_MISMATCH`)                                                               | `payments/webhook.service.ts`                            |
| **Idempotência — webhook**            | `WebhookEvent` com `@@unique([provider, externalId])`; repetição → `duplicate`                                                         | `payments/webhook.service.ts`                            |
| **Idempotência — efeitos**            | `UPDATE ... WHERE status IN (...)` em transação: a 2ª aplicação não gera notificação nem mexe em estoque                               | `payments/payment.service.ts` (`applyPaymentStatus`)     |
| **Idempotência — criação**            | Header `Idempotency-Key` em pedidos, doações e apadrinhamentos; chave repassada ao gateway                                             | `middlewares/idempotency.ts`, services                   |
| **Resiliência — retry**               | Backoff exponencial com jitter (200 ms, 400 ms, ...), só para falhas transitórias (rede, 5xx, 429)                                     | `lib/resilience.ts`                                      |
| **Resiliência — circuit breaker**     | `opossum` por integração (abre com 50% de falhas em ≥5 chamadas; testa de novo após 30 s); estado em `/health` e `/metrics`            | `lib/resilience.ts`                                      |
| **Resiliência — timeout**             | `HTTP_TIMEOUT_MS` (5 s) por tentativa; ViaCEP 3 s                                                                                      | `lib/http.ts`, `lib/resilience.ts`                       |
| **Resiliência — falha do gateway**    | Pedido é cancelado e o estoque devolvido; usuário recebe `502` com mensagem clara                                                      | `payments/payment.service.ts` (`chargePayment`)          |
| **Assíncrono**                        | Outbox + worker separado; reserva com `FOR UPDATE SKIP LOCKED` + `lockedUntil`; 6 tentativas com backoff (30 s → 1 h); depois `FAILED` | `notifications/outbox.worker.ts`, `worker.ts`            |
| **Assíncrono — expiração**            | Worker cancela pedidos com Pix não pago após `ORDER_PAYMENT_TTL_MINUTES` e devolve o estoque                                           | `orders.service.ts` (`expirePendingOrders`)              |
| **Observabilidade**                   | Logs JSON (`pino`) com `correlationId` em todas as linhas; `x-correlation-id` propagado às chamadas externas (no MP, em `metadata`)    | `lib/logger.ts`, `lib/request-context.ts`, `lib/http.ts` |
| **Observabilidade — health/metrics**  | `GET /health` (API, banco, cada integração + circuito); `GET /metrics` (HTTP, webhooks, pagamentos, outbox, chamadas externas)         | `modules/health`, `lib/metrics.ts`                       |
| **Rate limit**                        | Pagamentos 20/min por IP; formulários 10/min; login 20/15 min; API pública 60/min **por chave**                                        | `middlewares/rate-limit.ts`                              |
| **Documentação**                      | OpenAPI 3 com 75 operações e exemplos; schemas gerados dos mesmos Zod da validação; teste garante que toda rota documentada existe     | `docs/openapi.ts`, `test/openapi.test.ts`                |

## Testes automatizados

`npm test` (banco `bazar_test` isolado). Destaques:

- `payments.test.ts` — webhook duplicado, assinatura inválida, valor divergente, `Idempotency-Key`, gateway fora do ar, expiração.
- `fundraising.test.ts` — doações, campanha, assinatura (autorizar → cobrar → cancelar).
- `outbox.test.ts` — envio, backoff, `FAILED` após 6 tentativas, dois workers concorrentes.
- `resilience.test.ts` — retry, não-retry em 4xx, timeout, circuito abrindo; assinatura HMAC.
- `public-api.test.ts` — chave ausente/inválida/revogada, rate limit 429.
- `openapi.test.ts` — cada uma das 75 operações documentadas existe na aplicação.
