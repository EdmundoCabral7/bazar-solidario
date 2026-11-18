# Evidências — Bazar Solidário Digital

> Checklist para o **Relatório de Evidências de Extensão**. Entidade **simulada** (Associação Patas Potiguares).
> As imagens são geradas automaticamente pelo script [`tools/evidencias/capturar.mjs`](../tools/evidencias/capturar.mjs)
> (`npm run evidencias`), que executa os fluxos reais no navegador — ver [deploy.md](deploy.md#5-evidências).

**Ambiente das capturas:** _preencher após o deploy_ — Portal: `https://…vercel.app` · API: `https://…onrender.com` · Data: __/11/2026

## Entrega 1 — Plataforma/Portal de Negócios Digitais

| #   | Imagem                                                                | O que demonstra                                                       |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| ☐   | `E1-01-home-celular`                                                  | Home mobile-first: missão, impacto, campanha ativa, destaques         |
| ☐   | `E1-02-bazar-lista-celular`                                           | Vitrine do bazar com filtros (e-commerce social)                      |
| ☐   | `E1-03-bazar-peca-celular`                                            | Página da peça (URL compartilhável com Open Graph)                    |
| ☐   | `E1-04-carrinho-celular`                                              | Carrinho                                                              |
| ☐   | `E1-05-checkout-cep-frete-celular`                                    | Checkout: endereço pelo CEP (ViaCEP) e frete calculado (Melhor Envio) |
| ☐   | `E1-06-pedido-pix-celular`                                            | Cobrança Pix (QR Code + copia e cola) — Mercado Pago                  |
| ☐   | `E1-07-pedido-pago-celular`                                           | Pedido confirmado após o webhook                                      |
| ☐   | `E1-08-home-desktop`                                                  | Layout responsivo em desktop                                          |
| ☐   | `E1-09-adote-lista` · `E1-10-adote-animal` · `E1-11-adote-formulario` | Adoção online com triagem e consentimento LGPD                        |
| ☐   | `E1-12-doe` · `E1-13-apadrinhar-lista`                                | Doação avulsa e apadrinhamento recorrente                             |
| ☐   | `E1-14-transparencia` · `E1-15-transparencia-modo-escuro`             | Painel de transparência (arrecadado × gasto)                          |

## Entrega 2 — Manual de Governança de Serviços de TI (operação do catálogo)

| #   | Imagem / arquivo                                        | O que demonstra                                                                         |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ☐   | `E2-01-suporte-prioridade-calculada`                    | Matriz impacto × urgência calculando a prioridade e o SLA na abertura                   |
| ☐   | `E2-02-suporte-protocolo-e-prazos`                      | Protocolo e prazos de 1ª resposta/resolução (horário útil, feriados)                    |
| ☐   | `E2-03-admin-dashboard`                                 | Indicadores: chamados por prioridade e situação do SLA                                  |
| ☐   | `E2-04-fila-chamados-sla` · `E2-05-fila-todos-chamados` | Central de serviços: fila com indicador no prazo / em risco / violado                   |
| ☐   | `E2-06-detalhe-chamado`                                 | Atendimento: status, escalonamento N1→N2→N3, histórico (TicketEvent)                    |
| ☐   | `E2-07-relatorio-sla`                                   | **Relatório de SLA** do período simulado (conformidade, tempos médios, violações)       |
| ☐   | `E2-08` a `E2-11`                                       | Processos apoiados pelo painel: pedidos, adoções, **gestão de acessos (S06)**, despesas |
| ☐   | `sla-simulacao.txt`                                     | Saída do `npm run prod:simulation` (40 chamados em 2 semanas, ~20% com violação)        |

## Entrega 3 — Módulo de Integração (APIs/Web Services)

| #   | Imagem / arquivo                              | O que demonstra                                                                                               |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ☐   | `E3-01-swagger`                               | Documentação OpenAPI 3 (75 operações) — também em [`openapi.json`](openapi.json)                              |
| ☐   | `E3-02-health`                                | Saúde da API, do banco e de cada integração (com estado do circuit breaker)                                   |
| ☐   | `E3-03-metrics`                               | Métricas: webhooks recebidos/duplicados, pagamentos, outbox, chamadas externas                                |
| ☐   | `E3-04-parceiros-api-publica`                 | API pública (I05): parceiros e chaves `x-api-key`                                                             |
| ☐   | `E3-05-pedido-pago-via-webhook`               | Fluxo Pix → webhook assinado → pedido pago                                                                    |
| ☐   | [`testes-api.txt`](evidencias/testes-api.txt) | 181 testes automatizados: idempotência do webhook, assinatura, retry/circuit breaker, outbox, rate limit, SLA |
| ☐   | `curl-api-publica.txt`                        | Chamada real à API pública com chave (gerar com o comando abaixo)                                             |

```bash
API=https://<api>.onrender.com; KEY=<chave do parceiro>
{ curl -si "$API/api/public/v1/animals?pageSize=2" -H "x-api-key: $KEY";
  echo; curl -si "$API/api/public/v1/animals" -H "x-api-key: chave-errada"; } > docs/evidencias/curl-api-publica.txt
```

## Prints manuais sugeridos (fora do script)

- ☐ Painel do **Render** com o serviço _Live_ e os logs JSON mostrando `correlationId` e "lote da outbox processado".
- ☐ Painel da **Vercel** com o deploy concluído.
- ☐ Painel do **Neon** com as tabelas (`Ticket`, `WebhookEvent`, `NotificationOutbox`).
- ☐ Terminal com `npm run lint && npm run typecheck && npm test` passando.
