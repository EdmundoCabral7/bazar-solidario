# Bazar Solidário Digital 🐾

Plataforma web que leva para a internet o **bazar**, as **doações** e as **adoções** da
**Associação Patas Potiguares**, ONG de proteção animal de Natal/RN.

> ⚠️ **Entidade simulada para fins acadêmicos.** A Associação Patas Potiguares é fictícia e
> nenhum pagamento real é processado.

**Projeto de Extensão V — Plataformas Digitais e Governança de Serviços de TI para Entidades
Comunitárias** · Bacharelado em Sistemas de Informação · **UNI-RN** · Grupo 1

Integrantes: Edmundo Cabral, Rafael Alves, Guilherme e Luiz Augusto.

## Stack

| Camada      | Tecnologias                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Monorepo    | npm workspaces (`apps/api`, `apps/web`, `packages/shared`), TypeScript `strict`                   |
| API         | Node 20+, Express 5, Prisma + PostgreSQL, Zod, JWT, Swagger (OpenAPI 3), pino, Vitest + Supertest |
| Web         | Next.js 15 (App Router), Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod         |
| Infra local | Docker Compose (PostgreSQL 16)                                                                    |

## Como rodar localmente

Pré-requisitos: **Node 20 ou superior** e **Docker**.

```bash
# 1. Variáveis de ambiente
cp .env.example .env

# 2. Banco de dados (PostgreSQL na porta 5433)
docker compose up -d

# 3. Dependências
npm install

# 4. Migrations + dados de demonstração
npm run db:migrate
npm run db:seed        # imprime a API key do parceiro demo

# 5. API (http://localhost:3333) + portal (http://localhost:3000)
npm run dev

# 6. (outro terminal) worker de notificações e expiração de pedidos
npm run worker

# 7. (opcional) 40 chamados simulados + relatório de SLA
npm run seed:simulation
```

Nenhuma conta externa é necessária: com `INTEGRATIONS_MODE=mock` (padrão) todas as integrações
funcionam com simuladores.

| Endereço                          | O que é                           |
| --------------------------------- | --------------------------------- |
| http://localhost:3000             | Portal                            |
| http://localhost:3000/admin/login | Login administrativo              |
| http://localhost:3333/docs        | Documentação da API (Swagger UI)  |
| http://localhost:3333/health      | Saúde da API, banco e integrações |
| http://localhost:3333/metrics     | Métricas básicas                  |

### Credenciais de demonstração (ambiente local)

> Em **produção**, a senha do administrador é diferente e foi informada apenas no relatório entregue no Moodle.


| Perfil                 | E-mail                           | Senha      |
| ---------------------- | -------------------------------- | ---------- |
| Administrador          | `admin@pataspotiguares.org`      | `admin123` |
| Voluntário (N1)        | `voluntario@pataspotiguares.org` | `admin123` |
| Responsável de TI (N2) | `ti@pataspotiguares.org`         | `admin123` |

## Scripts

| Comando                                           | Descrição                                       |
| ------------------------------------------------- | ----------------------------------------------- |
| `npm run dev`                                     | API e portal em modo desenvolvimento            |
| `npm run worker`                                  | Worker da fila de notificações (outbox)         |
| `npm run lint` / `npm run typecheck` / `npm test` | Qualidade (os testes usam o banco `bazar_test`) |
| `npm run db:migrate` / `db:seed` / `db:reset`     | Banco de dados                                  |
| `npm run docs:export -w @bazar/api`               | Exporta `docs/openapi.json`                     |

## Variáveis de ambiente

Todas estão documentadas em [`.env.example`](.env.example). As principais:

| Variável              | Descrição                               |
| --------------------- | --------------------------------------- |
| `DATABASE_URL`        | Conexão PostgreSQL                      |
| `DATABASE_URL_TEST`   | Banco usado pelos testes                |
| `JWT_SECRET`          | Segredo do JWT (mín. 32 caracteres)     |
| `CORS_ORIGIN`         | Origem(ns) do portal permitidas no CORS |
| `INTEGRATIONS_MODE`   | `mock` (padrão) ou `sandbox`            |
| `NEXT_PUBLIC_API_URL` | URL da API usada pelo portal            |

## Portal (Entrega 1)

| Área              | Páginas                                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Público           | `/` home · `/bazar` → `/bazar/{peça}` → `/carrinho` → `/checkout` → `/pedido/{código}` · `/adote` → `/adote/{animal}` → `/adote/{animal}/quero-adotar` · `/adote/acompanhar` · `/doe` (avulsa) · `/doe/apadrinhar` → `/doe/apadrinhar/{animal}` · `/transparencia` · `/suporte` |
| Equipe (`/admin`) | Dashboard · Central de serviços (fila com SLA, detalhe, relatório) · Pedidos · Adoções · Animais · Peças · Despesas · Doações e padrinhos · Parceiros (API) · Usuários                                                                                                          |

- Mobile-first, navegação por teclado, rótulos e mensagens de erro ligados aos campos, contraste validado, modo escuro.
- Páginas de animal e de peça com metatags Open Graph (prévia no WhatsApp/Instagram).
- O menu do admin mostra só o que o perfil pode acessar (voluntário não vê tesouraria, parceiros nem usuários).

## Demonstração rápida (modo mock)

1. No portal, adicione uma peça ao carrinho e feche o pedido com Pix.
2. Na página do pedido, clique em **Simular pagamento aprovado** — o portal chama
   `POST /api/dev/payments/{id}/simulate`, que dispara o **mesmo fluxo do webhook** do Mercado Pago
   (assinatura, idempotência, transição). A página atualiza sozinha para _Pago_.
3. Com `npm run worker` rodando, a notificação de WhatsApp aparece no log.
4. Apadrinhamento: o "checkout do Mercado Pago" é substituído por uma página simulada com o botão **Autorizar assinatura**.
5. Cartão: no modo mock, o checkout oferece "cartão de teste aprovado/recusado".

Passo a passo completo em [docs/integracoes.md](docs/integracoes.md).

## Documentação

- [docs/arquitetura.md](docs/arquitetura.md) — componentes e decisões técnicas
- [docs/integracoes.md](docs/integracoes.md) — integrações I01–I05, como testar e requisitos não funcionais
- [docs/api-publica.md](docs/api-publica.md) — guia para parceiros da API pública
- [docs/openapi.json](docs/openapi.json) — especificação OpenAPI (75 operações)
- [docs/deploy.md](docs/deploy.md) — publicação em Neon, Render e Vercel
- [docs/evidencias.md](docs/evidencias.md) — checklist de evidências e captura automática

## Deploy

| Serviço                | URL           |
| ---------------------- | ------------- |
| Portal (Vercel)        | _a preencher_ |
| API + Swagger (Render) | _a preencher_ |

Passo a passo em [docs/deploy.md](docs/deploy.md) (Neon + Render + Vercel, planos gratuitos).
Checklist de prints para o relatório: [docs/evidencias.md](docs/evidencias.md).
