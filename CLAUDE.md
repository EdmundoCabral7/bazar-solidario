# CLAUDE.md — Bazar Solidário Digital

> Contexto permanente do projeto. Leia este arquivo inteiro antes de qualquer tarefa.
> Prazo final de entrega: **segunda, 30/11/2026, 23:55** (Moodle). Hoje o projeto começa em 19/11/2026.

---

## 1. O que é este projeto

Trabalho acadêmico do **Projeto de Extensão V — Plataformas Digitais e Governança de Serviços de TI para Entidades Comunitárias** (Bacharelado em Sistemas de Informação, **UNI-RN**, Grupo 1). Integrantes: **Edmundo Cabral, Rafael Alves, Guilherme e Luiz Augusto**.

O tema é o **Bazar Solidário Digital**: uma plataforma web que leva para a internet o bazar, as doações e as adoções de uma ONG de proteção animal de Natal/RN.

- **Entidade (simulada):** Associação Patas Potiguares — ONG fictícia de resgate e adoção de cães e gatos em Natal/RN. Deixe sempre claro na UI e nos docs que é uma **entidade simulada para fins acadêmicos**.
- **Problema hoje (AS-IS simulado):** doações por Pix sem identificação, bazar só presencial, adoções geridas em Instagram + Google Forms, informação espalhada em planilhas e WhatsApp, prestação de contas irregular, ninguém responsável por TI.

### Disciplinas que o projeto precisa evidenciar

1. **Negócios Digitais** → e-commerce social (bazar), doação avulsa, apadrinhamento recorrente, painel de transparência.
2. **Gestão de Serviços de TI (ITIL 4)** → catálogo de serviços, SLA, central de serviços com chamados (o sistema implementa isso — ver §6).
3. **Sistemas Distribuídos** → APIs REST, webhooks, processamento assíncrono, idempotência, retry/circuit breaker, API pública para parceiros.
4. **Tópicos Avançados em Programação** → stack moderna, TypeScript, testes, boas práticas.

### As 3 entregas (cada uma é um envio separado no Moodle)

| #   | Entrega                                                          | O que precisa existir                                                                                            |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | **Plataforma/Portal de Negócios Digitais** (aplicação web/móvel) | `apps/web` — Next.js responsivo, deploy público                                                                  |
| 2   | **Manual de Governança de Serviços de TI**                       | Documento PDF (feito fora do código). O código só precisa **implementar** o catálogo/SLA/chamados descritos aqui |
| 3   | **Módulo de Integração (APIs/Web Services)**                     | `apps/api` — API Node com integrações externas + API pública, documentada em Swagger, deploy público             |

---

## 2. Stack (decidida — não trocar sem perguntar)

- **Monorepo** com npm workspaces: `apps/api`, `apps/web`, `packages/shared` (tipos e schemas Zod compartilhados).
- **Linguagem:** TypeScript em tudo (`strict: true`). Node 20 LTS.
- **API (`apps/api`):** Express + Prisma + PostgreSQL + Zod (validação) + JWT (auth interna) + `swagger-ui-express` (OpenAPI 3) + `pino` (logs) + Vitest/Supertest (testes).
- **Web (`apps/web`):** Next.js (App Router) + Tailwind CSS + shadcn/ui + React Hook Form + Zod + TanStack Query para consumir a API.
- **Banco local:** PostgreSQL via `docker-compose.yml`.
- **Deploy (fase 4):** Web na Vercel, API no Render (ou Railway), banco no Neon (ou Supabase). Tudo em plano gratuito.

Se algo desta stack não fizer sentido durante a implementação, **pergunte antes de trocar**.

---

## 3. Convenções

- **Código** (variáveis, funções, tabelas, rotas) em **inglês**. **Textos de UI, mensagens de erro para o usuário, README e docs** em **português do Brasil**.
- Arquitetura da API em camadas por módulo: `routes → controller → service → repository (Prisma)`. Integrações externas ficam em `src/integrations/<provedor>/` atrás de uma **interface** (ex.: `PaymentProvider`, `ShippingProvider`, `NotificationProvider`) para permitir trocar a implementação real por um **mock**.
- Toda integração externa precisa funcionar em **modo sandbox ou mock** sem credenciais reais. Variável `INTEGRATIONS_MODE=mock|sandbox` define qual usar. O projeto tem que rodar do zero só com `docker compose up` + `npm run dev`, sem nenhuma conta externa.
- **Nunca** commitar segredos. Manter `.env.example` atualizado com todas as variáveis (sem valores reais).
- Respostas de erro da API no formato `{ "error": { "code": "STRING", "message": "texto em pt-BR", "details"?: ... } }`.
- Toda requisição recebe um `x-correlation-id` (gerar se não vier) que aparece em todos os logs e é repassado nas chamadas externas.
- Commits pequenos e descritivos (Conventional Commits em português: `feat: adiciona webhook de pagamento`). Commite ao fim de cada etapa concluída.
- Antes de dar uma etapa como concluída: `npm run lint`, `npm run typecheck` e `npm test` passando.

---

## 4. Domínio — modelos principais (Prisma)

Ajuste campos se necessário, mas mantenha a ideia:

- `User` — volunteers/admins internos. `role: ADMIN | VOLUNTEER | SUPPORT_N2`.
- `Animal` — nome, espécie (DOG/CAT), idade aproximada, porte, sexo, castrado, vacinado, descrição, fotos, `status: AVAILABLE | IN_ADOPTION | ADOPTED`.
- `Product` — peça do bazar: título, descrição, categoria, tamanho, condição, preço (centavos, `Int`), fotos, estoque, `status: ACTIVE | SOLD | HIDDEN`.
- `Order` / `OrderItem` — pedido do bazar; `status: PENDING_PAYMENT | PAID | SHIPPED | DELIVERED | CANCELED`; frete; tipo de entrega (`PICKUP | SHIPPING`).
- `Donation` — doação avulsa (valor, nome/e-mail do doador opcional, anônima ou não).
- `Sponsorship` — apadrinhamento mensal vinculado a um `Animal` (planos R$ 20 / R$ 50 / R$ 100), `status: ACTIVE | PAUSED | CANCELED`, id da assinatura no gateway.
- `Payment` — referência única ao pagamento no gateway, ligado a `Order` OU `Donation` OU `Sponsorship`; método (PIX/CARD); status.
- `AdoptionRequest` — dados do interessado + questionário de triagem; `status: RECEIVED | IN_REVIEW | INTERVIEW | APPROVED | REJECTED`.
- `Expense` — gastos da ONG por categoria (RAÇÃO, VETERINÁRIO, CASTRAÇÃO, MANUTENÇÃO, OUTROS) para o painel de transparência.
- `Partner` — parceiro externo (pet shop, clínica) com `apiKeyHash`, nome, ativo.
- `WebhookEvent` — `provider` + `externalId` **únicos** (garante idempotência).
- `NotificationOutbox` — fila de notificações: canal (WHATSAPP/EMAIL), destinatário, template, payload, `status: PENDING | SENT | FAILED`, tentativas, próxima tentativa.
- `ItService` — catálogo de serviços de TI (S01–S08, ver §6).
- `Ticket` / `TicketEvent` — chamados da central de serviços (ver §6).

Dados pessoais (doadores, adotantes): só o necessário (LGPD), com campo de consentimento e data.

---

## 5. Módulo de Integração — requisitos (Entrega 3)

### Integrações externas

| ID  | Sistema                  | Uso                                                                                           | Implementação                                                             |
| --- | ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| I01 | **Mercado Pago**         | Pix (QR Code) e cartão; assinaturas (preapproval) para apadrinhamento; webhook de confirmação | SDK oficial `mercadopago`, modo sandbox + mock                            |
| I02 | **Melhor Envio**         | Cotação de frete por CEP                                                                      | REST/OAuth2 em sandbox + mock com tabela fixa                             |
| I03 | **ViaCEP**               | Endereço a partir do CEP                                                                      | REST público (real, sem chave) com cache em memória                       |
| I04 | **WhatsApp Cloud API**   | Notificações de pedido, doação, adoção                                                        | Mock por padrão (loga a mensagem); real opcional por env                  |
| I05 | **API pública do Bazar** | Parceiros consultam animais para adoção e campanhas ativas                                    | `/api/public/v1/*`, autenticação `x-api-key`, somente leitura, rate limit |

### Requisitos funcionais

- **RFI01:** gerar cobrança Pix (QR Code + copia-e-cola) e confirmar via **webhook**.
- **RFI02:** criar e cancelar assinatura mensal de apadrinhamento.
- **RFI03:** calcular frete pelo CEP antes de fechar o pedido.
- **RFI04:** notificar comprador/doador/adotante a cada mudança de status (via outbox assíncrona).
- **RFI05:** endpoints públicos somente leitura para parceiros.
- **Simulador de pagamento:** em `INTEGRATIONS_MODE=mock`, um endpoint de dev `POST /api/dev/payments/:id/simulate` dispara o mesmo fluxo do webhook (aprovado/recusado), para demonstração no seminário.

### Requisitos não funcionais (precisam estar visíveis no código — são avaliados)

- **Segurança:** HTTPS no deploy; JWT para rotas internas; **validação da assinatura do webhook** do Mercado Pago (`x-signature`); `helmet`; CORS restrito ao domínio do web.
- **Idempotência:** webhook repetido não processa o mesmo pagamento duas vezes (`WebhookEvent` com chave única + transação). Endpoints de criação de pagamento aceitam header `Idempotency-Key`.
- **Resiliência:** retry com backoff exponencial e **circuit breaker** (`opossum`) em todas as chamadas externas; timeout configurado.
- **Assíncrono:** notificações saem pela tabela `NotificationOutbox`, processada por um **worker** separado (`npm run worker`) com retentativas. O pedido nunca espera a notificação.
- **Observabilidade:** logs JSON (`pino`) com `correlationId`; endpoint `GET /health` (status da API, banco e de cada integração) e `GET /metrics` simples (contadores básicos).
- **Rate limit:** `express-rate-limit` na API pública e nos endpoints de pagamento.
- **Documentação:** OpenAPI 3 em `GET /docs` (Swagger UI) cobrindo **todas** as rotas, com exemplos. Exportar também `docs/openapi.json`.

---

## 6. Governança de TI (ITIL) implementada no sistema

O Manual de Governança (Entrega 2) é um documento à parte, mas o sistema precisa **operar** o que ele descreve, para a etapa de "simulação da operação do catálogo de serviços".

### Catálogo de serviços (seed em `ItService`)

| ID  | Serviço                    | Dono                   | Disponibilidade-meta  |
| --- | -------------------------- | ---------------------- | --------------------- |
| S01 | Loja do bazar online       | Coordenação do bazar   | 99,5%                 |
| S02 | Doações e apadrinhamento   | Tesouraria             | 99,5%                 |
| S03 | Adoção online              | Coordenação de adoções | 99,5%                 |
| S04 | Painel de transparência    | Tesouraria             | 99%                   |
| S05 | Painel administrativo      | Responsável de TI      | 99%                   |
| S06 | Gestão de acessos          | Responsável de TI      | 99%                   |
| S07 | Backup e proteção de dados | Responsável de TI      | — (RPO 24 h, RTO 4 h) |
| S08 | Central de atendimento     | Responsável de TI      | 99%                   |

### SLA por prioridade

| Prioridade | Definição                               | 1ª resposta       | Resolução      |
| ---------- | --------------------------------------- | ----------------- | -------------- |
| P1 Crítica | Serviço fora do ar ou perda de dinheiro | 30 min (corridas) | 4 h (corridas) |
| P2 Alta    | Função importante falha, há contorno    | 2 h úteis         | 8 h úteis      |
| P3 Média   | Falha pontual, poucos usuários          | 4 h úteis         | 2 dias úteis   |
| P4 Baixa   | Dúvida ou requisição padrão             | 1 dia útil        | 3 dias úteis   |

Horário útil: seg–sex, 8h–18h, fuso `America/Fortaleza`. P1 conta em horas corridas.

### Central de serviços (módulo `tickets`)

- Abrir chamado: público (formulário do portal, sem login) ou interno. Campos: serviço (S01–S08), tipo (`INCIDENT | SERVICE_REQUEST`), impacto e urgência → **prioridade calculada por matriz impacto × urgência**.
- Ao criar: calcular `responseDueAt` e `resolutionDueAt` conforme SLA (função pura `calculateSlaDeadlines`, **com testes unitários cobrindo horário útil, fim de semana e P1**).
- Níveis: `N1` (voluntário) → `N2` (responsável de TI) → `N3` (desenvolvimento). Endpoint de escalonamento registra `TicketEvent`.
- Status: `OPEN | IN_PROGRESS | WAITING_USER | RESOLVED | CLOSED`.
- Incidentes repetidos no mesmo serviço podem ser vinculados a um `problemId` (gerenciamento de problemas, simples).
- **Relatório de SLA:** `GET /api/tickets/sla-report?from=&to=` → total por prioridade, % dentro do prazo de resposta e de resolução, tempo médio, chamados violados.
- **Seed de simulação:** script `npm run seed:simulation` que gera ~40 chamados fictícios distribuídos em 2 semanas (mix de prioridades, alguns violando SLA) para gerar o relatório usado como evidência.

---

## 7. Portal (Entrega 1) — páginas do `apps/web`

**Públicas**

- Home: missão da ONG (simulada), destaques (animais, peças), CTA doar/adotar/comprar, números de impacto.
- Bazar: listagem com filtros → página da peça → carrinho → checkout (CEP, frete ou retirada, Pix/cartão) → página do pedido com status.
- Adote: listagem de animais com filtros → página do animal → formulário de adoção (triagem + consentimento LGPD).
- Doe: doação avulsa (valores sugeridos + livre) e **apadrinhamento** (escolher animal + plano).
- Transparência: arrecadado × gasto por mês e por categoria (gráficos), dados vindos da API.
- Suporte: abrir chamado e acompanhar por número de protocolo.
- Cada animal e peça tem URL compartilhável com metatags Open Graph (para stories/WhatsApp).

**Admin (login JWT)**

- Dashboard (vendas, doações, padrinhos ativos, adoções em andamento, chamados abertos por prioridade).
- CRUDs: animais, peças, pedidos (mudar status), adoções (fluxo de triagem), despesas, parceiros (gerar/revogar API key), usuários.
- Central de serviços: fila de chamados com indicador de SLA (no prazo / em risco / violado), escalonamento, relatório de SLA.

Requisitos: **mobile-first** e responsivo, acessível (contraste, labels, navegação por teclado), visual limpo e acolhedor, em pt-BR. Imagens de animais/peças: placeholders livres (sem fotos de pessoas reais).

---

## 8. Plano de fases

| Fase                       | Datas    | Entregáveis                                                                                                                                                     |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Fundação**            | 19–20/11 | Monorepo, docker-compose, Prisma schema + migrations, seed básico, auth JWT, estrutura de módulos, `/health`, Swagger rodando, lint/typecheck/test configurados |
| **2. API e integrações**   | 21–25/11 | Módulos de domínio, Mercado Pago (mock+sandbox) + webhook idempotente, frete, ViaCEP, outbox + worker, API pública, tickets + SLA + relatório, testes           |
| **3. Portal**              | 24–27/11 | Todas as páginas do §7 consumindo a API                                                                                                                         |
| **4. Deploy e evidências** | 28–29/11 | Deploy (Vercel + Render + Neon), seed de simulação em produção, prints, `docs/` completo                                                                        |
| **Envio**                  | 30/11    | Revisão final e envio antes das 23:55                                                                                                                           |

Ao terminar cada fase, atualize a seção **"Status"** no fim deste arquivo.

---

## 9. Documentação e evidências que o repositório deve ter (`docs/`)

- `README.md` (raiz): visão geral, stack, como rodar local (passo a passo), variáveis de ambiente, links de deploy, credenciais de demonstração do admin.
- `docs/arquitetura.md`: diagrama (Mermaid) dos componentes e do fluxo de pagamento com webhook; decisões técnicas e justificativas ligadas às disciplinas.
- `docs/integracoes.md`: cada integração (I01–I05), endpoints, como testar em mock/sandbox, como os requisitos não funcionais foram atendidos.
- `docs/api-publica.md`: guia para parceiros (como obter chave, exemplos `curl`).
- `docs/openapi.json`: exportado.
- `docs/evidencias.md`: checklist de prints e onde foram capturados (para o Relatório de Evidências de Extensão).

---

## 10. Como trabalhar comigo (Claude Code)

- Trabalhe **uma fase por vez**. No início de cada fase, apresente um plano curto (arquivos/módulos que vai criar) e só então implemente.
- Quando houver decisão não coberta aqui que mude o escopo ou a stack, **pergunte**. Decisões pequenas de implementação: decida e registre em `docs/arquitetura.md`.
- Prefira entregar algo **funcionando de ponta a ponta** a algo completo pela metade. Se o prazo apertar, priorize nesta ordem: fluxo de pagamento com webhook → API pública → tickets/SLA → bazar no portal → doação/apadrinhamento → adoção → admin → transparência.
- Ao final de cada fase, me diga: o que foi feito, como testar, e o que ficou pendente.

---

## Status

- [x] Fase 1 — Fundação (concluída em 18/11/2026; banco local na porta 5433)
- [x] Fase 2 — API e integrações (concluída em 18/11/2026; 75 rotas documentadas; criação interna de chamado em `/api/tickets/internal`; nova tabela `Campaign`)
- [x] Fase 3 — Portal (concluída em 18/11/2026; testado ponta a ponta com Playwright; cartão real no sandbox pendente — exige SDK JS do Mercado Pago)
- [ ] Fase 4 — Deploy e evidências
