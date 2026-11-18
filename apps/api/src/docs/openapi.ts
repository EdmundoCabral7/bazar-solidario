/**
 * Especificação OpenAPI 3 da API. Servida em GET /docs (Swagger UI) e GET /docs.json, e
 * exportada para docs/openapi.json (npm run docs:export -w @bazar/api).
 *
 * Os schemas de entrada são gerados a partir dos MESMOS schemas Zod usados na validação
 * (pacote @bazar/shared), então a documentação não diverge do comportamento real.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
import * as s from '@bazar/shared';

type Json = Record<string, unknown>;

function schemaOf(zod: ZodTypeAny): Json {
  const { $schema: _ignored, ...rest } = zodToJsonSchema(zod, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Json;
  return rest;
}

/** Converte um schema Zod de objeto em parâmetros de query. */
function queryParams(zod: ZodTypeAny): Json[] {
  const json = schemaOf(zod) as { properties?: Record<string, Json>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([name, schema]) => ({
    name,
    in: 'query',
    required: json.required?.includes(name) ?? false,
    schema,
  }));
}

const pathParam = (name: string, description: string, example?: string): Json => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' },
  ...(example ? { example } : {}),
});

const errorRef = { $ref: '#/components/schemas/Error' };
const errorResponse = (description: string, code?: string, message?: string): Json => ({
  description,
  content: {
    'application/json': {
      schema: errorRef,
      ...(code ? { example: { error: { code, message: message ?? description } } } : {}),
    },
  },
});

const COMMON_ERRORS = {
  '400': errorResponse('Dados inválidos', 'VALIDATION_ERROR', 'Dados inválidos'),
};
const AUTH_ERRORS = {
  '401': errorResponse('Sem token ou token inválido', 'UNAUTHORIZED', 'Autenticação necessária'),
  '403': errorResponse(
    'Perfil sem permissão',
    'FORBIDDEN',
    'Você não tem permissão para esta ação',
  ),
};

interface OpDef {
  tag: string;
  summary: string;
  description?: string;
  auth?: 'jwt' | 'apiKey';
  params?: Json[];
  query?: ZodTypeAny;
  body?: ZodTypeAny | Json;
  bodyExample?: unknown;
  idempotent?: boolean;
  /** status → [descrição, exemplo] */
  responses: Record<string, [string, unknown?]>;
  errors?: Record<string, Json>;
}

function op(def: OpDef): Json {
  const parameters: Json[] = [
    { $ref: '#/components/parameters/CorrelationId' },
    ...(def.params ?? []),
  ];
  if (def.query) parameters.push(...queryParams(def.query));
  if (def.idempotent) parameters.push({ $ref: '#/components/parameters/IdempotencyKey' });

  const responses: Json = {};
  for (const [status, [description, example]] of Object.entries(def.responses)) {
    responses[status] =
      example === undefined
        ? { description }
        : { description, content: { 'application/json': { example } } };
  }
  Object.assign(responses, def.errors ?? {});
  if (def.body && !responses['400']) Object.assign(responses, COMMON_ERRORS);
  if (def.auth === 'jwt') Object.assign(responses, AUTH_ERRORS);
  if (def.auth === 'apiKey') {
    responses['401'] = errorResponse(
      'Chave ausente, inválida ou revogada',
      'INVALID_API_KEY',
      'Chave de API inválida ou revogada',
    );
    responses['429'] = errorResponse(
      'Limite de 60 req/min por chave excedido',
      'RATE_LIMITED',
      'Limite de requisições da API pública excedido',
    );
  }

  return {
    tags: [def.tag],
    summary: def.summary,
    ...(def.description ? { description: def.description } : {}),
    ...(def.auth === 'jwt' ? { security: [{ bearerAuth: [] }] } : {}),
    ...(def.auth === 'apiKey' ? { security: [{ apiKey: [] }] } : {}),
    parameters,
    ...(def.body
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: 'parse' in def.body ? schemaOf(def.body as ZodTypeAny) : def.body,
                ...(def.bodyExample ? { example: def.bodyExample } : {}),
              },
            },
          },
        }
      : {}),
    responses,
  };
}

// ---------- Exemplos ----------

const animalExample = {
  id: 'cmwm...',
  slug: 'caramelo',
  name: 'Caramelo',
  species: 'DOG',
  ageMonths: 24,
  size: 'MEDIUM',
  sex: 'MALE',
  neutered: true,
  vaccinated: true,
  description: 'Dócil, adora passear e se dá bem com crianças.',
  photos: ['https://placehold.co/800x600?text=Caramelo'],
  status: 'AVAILABLE',
  activeSponsors: 2,
};
const productExample = {
  id: 'cmwm...',
  slug: 'camisa-polo-azul-m',
  title: 'Camisa polo azul',
  description: 'Camisa polo masculina, pouquíssimo uso.',
  category: 'Roupas',
  size: 'M',
  condition: 'LIKE_NEW',
  priceCents: 2500,
  photos: ['https://placehold.co/800x600?text=Camisa'],
  stock: 1,
  weightGrams: 500,
  status: 'ACTIVE',
};
const paymentPixExample = {
  id: 'cmwmpay...',
  method: 'PIX',
  status: 'PENDING',
  amountCents: 4390,
  pixCopyPaste: '00020126580014BR.GOV.BCB.PIX0136...6304ABCD',
  pixQrCodeBase64: null,
  expiresAt: '2026-11-25T15:30:00.000Z',
  paidAt: null,
};
const orderExample = {
  id: 'cmwmord...',
  code: 'PED-GB6JUW',
  status: 'PENDING_PAYMENT',
  customer: { name: 'Maria Silva', email: 'maria@example.com', phone: '84999991234' },
  delivery: {
    type: 'SHIPPING',
    cep: '59015000',
    street: 'Av. Salgado Filho',
    number: '10',
    city: 'Natal',
    state: 'RN',
    trackingCode: null,
  },
  items: [
    {
      productId: 'cmwm...',
      slug: 'camisa-polo-azul-m',
      title: 'Camisa polo azul',
      quantity: 1,
      unitPriceCents: 2500,
    },
  ],
  subtotalCents: 2500,
  shippingCents: 1890,
  totalCents: 4390,
  payment: paymentPixExample,
};
const page = (data: unknown[]) => ({
  data,
  page: 1,
  pageSize: 20,
  total: data.length,
  totalPages: 1,
});
const ticketExample = {
  id: 'cmwmtk...',
  protocol: 'CH-2026-7K2QXA',
  service: { code: 'S01', name: 'Loja do bazar online' },
  type: 'INCIDENT',
  title: 'Checkout não abre',
  priority: 'P2',
  level: 'N1',
  status: 'OPEN',
  responseDueAt: '2026-11-25T16:00:00.000Z',
  resolutionDueAt: '2026-11-26T15:00:00.000Z',
  slaState: 'ON_TRACK',
};

const idParam = pathParam('id', 'Identificador interno');

// ---------- Paths ----------

const paths: Json = {
  // Observabilidade
  '/health': {
    get: op({
      tag: 'Observabilidade',
      summary: 'Status da API, do banco e de cada integração (inclui estado do circuit breaker)',
      responses: {
        '200': [
          'Operacional',
          {
            status: 'ok',
            database: { status: 'up', latencyMs: 2 },
            integrations: [
              { name: 'mercadopago', mode: 'mock', status: 'up' },
              { name: 'viacep', mode: 'real', status: 'up', circuit: 'closed' },
            ],
          },
        ],
        '503': ['Banco de dados indisponível'],
      },
    }),
  },
  '/metrics': {
    get: op({
      tag: 'Observabilidade',
      summary:
        'Contadores básicos (HTTP, webhooks, pagamentos, outbox, chamadas externas, circuit breakers)',
      responses: {
        '200': [
          'Métricas',
          {
            uptimeSeconds: 3600,
            requestsTotal: 420,
            responses2xx: 400,
            responses4xx: 18,
            responses5xx: 2,
            counters: {
              'webhooks.received': 12,
              'webhooks.duplicate': 3,
              'payments.approved': 9,
              'outbox.sent': 30,
              'external.viacep.success': 15,
            },
            circuitBreakers: { viacep: 'closed' },
          },
        ],
      },
    }),
  },

  // Autenticação
  '/api/auth/login': {
    post: op({
      tag: 'Autenticação',
      summary: 'Login de usuário interno; retorna JWT',
      body: s.loginSchema,
      bodyExample: { email: 'admin@pataspotiguares.org', password: 'admin123' },
      responses: {
        '200': [
          'Login efetuado',
          {
            token: 'eyJhbGciOi...',
            user: {
              id: 'cmwm...',
              name: 'Administrador(a) Demo',
              email: 'admin@pataspotiguares.org',
              role: 'ADMIN',
            },
          },
        ],
      },
      errors: {
        '401': errorResponse(
          'Credenciais incorretas',
          'INVALID_CREDENTIALS',
          'E-mail ou senha incorretos',
        ),
        '429': errorResponse(
          'Muitas tentativas',
          'RATE_LIMITED',
          'Muitas tentativas. Aguarde alguns minutos.',
        ),
      },
    }),
  },
  '/api/auth/me': {
    get: op({
      tag: 'Autenticação',
      summary: 'Usuário autenticado',
      auth: 'jwt',
      responses: {
        '200': ['Usuário', { id: 'cmwm...', name: 'Administrador(a) Demo', role: 'ADMIN' }],
      },
    }),
  },

  // Catálogo
  '/api/animals': {
    get: op({
      tag: 'Catálogo',
      summary: 'Animais para adoção (disponíveis e em processo)',
      query: s.animalFiltersSchema,
      responses: { '200': ['Página de animais', page([animalExample])] },
    }),
  },
  '/api/animals/{slug}': {
    get: op({
      tag: 'Catálogo',
      summary: 'Detalhe do animal (URL compartilhável)',
      params: [pathParam('slug', 'Slug do animal', 'caramelo')],
      responses: { '200': ['Animal', animalExample] },
      errors: { '404': errorResponse('Animal não encontrado', 'NOT_FOUND') },
    }),
  },
  '/api/products': {
    get: op({
      tag: 'Catálogo',
      summary: 'Peças do bazar à venda',
      query: s.productFiltersSchema,
      responses: { '200': ['Página de peças', page([productExample])] },
    }),
  },
  '/api/products/categories': {
    get: op({
      tag: 'Catálogo',
      summary: 'Categorias com peças à venda',
      responses: { '200': ['Categorias', [{ category: 'Roupas', count: 12 }]] },
    }),
  },
  '/api/products/{slug}': {
    get: op({
      tag: 'Catálogo',
      summary: 'Detalhe da peça',
      params: [pathParam('slug', 'Slug da peça', 'camisa-polo-azul-m')],
      responses: { '200': ['Peça', productExample] },
      errors: { '404': errorResponse('Peça não encontrada', 'NOT_FOUND') },
    }),
  },
  '/api/campaigns': {
    get: op({
      tag: 'Catálogo',
      summary: 'Campanhas ativas com progresso',
      responses: {
        '200': [
          'Campanhas',
          [
            {
              slug: 'mutirao-castracao-2026',
              title: 'Mutirão de castração 2026',
              goalCents: 900000,
              raisedCents: 125000,
              progressPct: 14,
            },
          ],
        ],
      },
    }),
  },
  '/api/campaigns/{slug}': {
    get: op({
      tag: 'Catálogo',
      summary: 'Detalhe da campanha',
      params: [pathParam('slug', 'Slug da campanha')],
      responses: { '200': ['Campanha'] },
      errors: { '404': errorResponse('Campanha não encontrada', 'NOT_FOUND') },
    }),
  },

  // Frete e CEP
  '/api/cep/{cep}': {
    get: op({
      tag: 'Frete e CEP',
      summary: 'Endereço pelo CEP (I03 — ViaCEP, com cache de 24 h)',
      params: [pathParam('cep', 'CEP com ou sem hífen', '59015-000')],
      responses: {
        '200': [
          'Endereço',
          {
            cep: '59015000',
            street: 'Avenida Senador Salgado Filho',
            district: 'Tirol',
            city: 'Natal',
            state: 'RN',
          },
        ],
      },
      errors: {
        '404': errorResponse('CEP inexistente', 'CEP_NOT_FOUND', 'CEP não encontrado'),
        '503': errorResponse(
          'ViaCEP indisponível (circuito aberto)',
          'CEP_SERVICE_UNAVAILABLE',
          'Consulta de CEP indisponível. Preencha o endereço manualmente.',
        ),
      },
    }),
  },
  '/api/shipping/quote': {
    post: op({
      tag: 'Frete e CEP',
      summary: 'Cotação de frete do carrinho (I02 — Melhor Envio)',
      body: s.shippingQuoteSchema,
      bodyExample: { cep: '59015-000', items: [{ productId: 'cmwm...', quantity: 1 }] },
      responses: {
        '200': [
          'Opções de entrega',
          {
            cep: '59015000',
            package: { weightGrams: 500, heightCm: 10, widthCm: 25, lengthCm: 35 },
            options: [
              { service: 'PAC', company: 'Correios', priceCents: 1890, deliveryDays: 3 },
              { service: 'SEDEX', company: 'Correios', priceCents: 2990, deliveryDays: 1 },
            ],
          },
        ],
      },
      errors: {
        '409': errorResponse('Peça indisponível ou sem estoque', 'OUT_OF_STOCK'),
        '503': errorResponse('Frete indisponível', 'SHIPPING_SERVICE_UNAVAILABLE'),
      },
    }),
  },

  // Bazar
  '/api/orders': {
    post: op({
      tag: 'Bazar — pedidos',
      summary: 'Fecha o pedido e gera a cobrança (Pix ou cartão)',
      description:
        'Reserva o estoque, recalcula o frete no servidor e cria o pagamento no gateway (I01). ' +
        'Com `Idempotency-Key` repetida devolve o mesmo pedido (200 + `Idempotent-Replayed: true`), sem nova cobrança. ' +
        'Rate limit: 20/min por IP. Em modo mock, cartão com token `mock-card-rejected` é recusado.',
      body: s.createOrderSchema,
      idempotent: true,
      bodyExample: {
        customer: { name: 'Maria Silva', email: 'maria@example.com', phone: '(84) 99999-1234' },
        items: [{ productId: 'cmwm...', quantity: 1 }],
        delivery: {
          type: 'SHIPPING',
          cep: '59015-000',
          street: 'Av. Salgado Filho',
          number: '10',
          district: 'Tirol',
          city: 'Natal',
          state: 'RN',
          shippingService: 'PAC',
        },
        payment: { method: 'PIX' },
        consent: true,
      },
      responses: {
        '201': ['Pedido criado', orderExample],
        '200': ['Repetição idempotente (mesmo pedido)', orderExample],
      },
      errors: {
        '409': errorResponse(
          'Sem estoque',
          'OUT_OF_STOCK',
          '"Camisa polo azul" acabou de ser vendido',
        ),
        '429': errorResponse('Muitas tentativas', 'RATE_LIMITED'),
        '502': errorResponse(
          'Gateway de pagamento indisponível',
          'PAYMENT_PROVIDER_UNAVAILABLE',
          'O serviço de pagamento está indisponível no momento. Tente novamente em alguns minutos.',
        ),
      },
    }),
  },
  '/api/orders/{code}': {
    get: op({
      tag: 'Bazar — pedidos',
      summary: 'Acompanhamento do pedido pelo código (e-mail mascarado)',
      params: [pathParam('code', 'Código do pedido', 'PED-GB6JUW')],
      responses: {
        '200': [
          'Pedido',
          { ...orderExample, customer: { name: 'Maria Silva', email: 'ma***@example.com' } },
        ],
      },
      errors: { '404': errorResponse('Pedido não encontrado', 'NOT_FOUND') },
    }),
  },

  // Doações
  '/api/donations': {
    post: op({
      tag: 'Doações e apadrinhamento',
      summary: 'Doação avulsa (Pix ou cartão), opcionalmente para uma campanha',
      body: s.createDonationSchema,
      idempotent: true,
      bodyExample: {
        amountCents: 5000,
        donorName: 'Ana',
        donorEmail: 'ana@example.com',
        consent: true,
        campaignSlug: 'mutirao-castracao-2026',
        payment: { method: 'PIX' },
      },
      responses: {
        '201': [
          'Doação criada',
          {
            id: 'cmwmdon...',
            amountCents: 5000,
            anonymous: false,
            campaign: { slug: 'mutirao-castracao-2026', title: 'Mutirão de castração 2026' },
            payment: { ...paymentPixExample, amountCents: 5000 },
          },
        ],
      },
      errors: { '502': errorResponse('Gateway indisponível', 'PAYMENT_PROVIDER_UNAVAILABLE') },
    }),
  },
  '/api/donations/{id}': {
    get: op({
      tag: 'Doações e apadrinhamento',
      summary: 'Status da doação (o portal consulta até o Pix ser pago)',
      params: [idParam],
      responses: { '200': ['Doação'] },
      errors: { '404': errorResponse('Não encontrada', 'NOT_FOUND') },
    }),
  },
  '/api/sponsorships': {
    post: op({
      tag: 'Doações e apadrinhamento',
      summary: 'Apadrinhamento mensal (assinatura recorrente — preapproval do Mercado Pago)',
      description:
        'Cria a assinatura no gateway e devolve `checkoutUrl` para o padrinho autorizar. A ativação chega por webhook `subscription_preapproval`.',
      body: s.createSponsorshipSchema,
      idempotent: true,
      bodyExample: {
        animalSlug: 'caramelo',
        plan: 'P50',
        sponsorName: 'João',
        sponsorEmail: 'joao@example.com',
        consent: true,
      },
      responses: {
        '201': [
          'Apadrinhamento pendente',
          {
            id: 'cmwmsp...',
            status: 'PENDING',
            plan: 'P50',
            amountCents: 5000,
            animal: { slug: 'caramelo', name: 'Caramelo' },
            checkoutUrl: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=...',
          },
        ],
      },
      errors: { '502': errorResponse('Gateway indisponível', 'PAYMENT_PROVIDER_UNAVAILABLE') },
    }),
  },
  '/api/sponsorships/{id}': {
    get: op({
      tag: 'Doações e apadrinhamento',
      summary: 'Status do apadrinhamento',
      params: [idParam],
      responses: { '200': ['Apadrinhamento'] },
      errors: { '404': errorResponse('Não encontrado', 'NOT_FOUND') },
    }),
  },
  '/api/sponsorships/{id}/cancel': {
    post: op({
      tag: 'Doações e apadrinhamento',
      summary: 'Cancelamento pelo padrinho (confirma pelo e-mail)',
      params: [idParam],
      body: s.cancelSponsorshipSchema,
      bodyExample: { email: 'joao@example.com' },
      responses: { '200': ['Cancelado', { id: 'cmwmsp...', status: 'CANCELED' }] },
      errors: { '404': errorResponse('Não encontrado para este e-mail', 'NOT_FOUND') },
    }),
  },

  // Adoção
  '/api/adoptions': {
    post: op({
      tag: 'Adoção',
      summary: 'Solicitação de adoção com questionário de triagem (consentimento LGPD obrigatório)',
      body: s.createAdoptionSchema,
      bodyExample: {
        animalSlug: 'caramelo',
        applicantName: 'Pedro Lima',
        applicantEmail: 'pedro@example.com',
        applicantPhone: '(84) 98888-7777',
        city: 'Natal',
        answers: {
          housingType: 'HOUSE',
          ownsHome: true,
          hasYard: true,
          hasOtherPets: false,
          hasChildren: false,
          hoursAlonePerDay: 4,
          allResidentsAgree: true,
          canAffordCosts: true,
          motivation: 'Sempre tive cachorros e tenho espaço e tempo para cuidar.',
        },
        consent: true,
      },
      responses: {
        '201': [
          'Recebida',
          {
            code: 'ADO-4F7K2Q',
            status: 'RECEIVED',
            animal: { slug: 'caramelo', name: 'Caramelo' },
          },
        ],
      },
      errors: { '409': errorResponse('Já existe solicitação em andamento', 'DUPLICATE_REQUEST') },
    }),
  },
  '/api/adoptions/{code}': {
    get: op({
      tag: 'Adoção',
      summary: 'Acompanhamento da solicitação pelo protocolo',
      params: [pathParam('code', 'Protocolo', 'ADO-4F7K2Q')],
      responses: {
        '200': [
          'Solicitação',
          {
            code: 'ADO-4F7K2Q',
            status: 'IN_REVIEW',
            animal: { slug: 'caramelo', name: 'Caramelo' },
          },
        ],
      },
      errors: { '404': errorResponse('Não encontrada', 'NOT_FOUND') },
    }),
  },

  // Transparência
  '/api/transparency': {
    get: op({
      tag: 'Transparência',
      summary: 'Arrecadado × gasto por mês e por categoria (somente dados agregados)',
      query: s.transparencyQuerySchema,
      responses: {
        '200': [
          'Painel',
          {
            totals: { raisedCents: 145390, spentCents: 165000, balanceCents: -19610 },
            spentByCategory: { RACAO: 10500, VETERINARIO: 21000 },
            months: [
              {
                month: '2026-11',
                raisedCents: { sales: 4390, donations: 32000, sponsorships: 5000, total: 41390 },
                spentCents: { total: 52500, byCategory: { RACAO: 3500 } },
                balanceCents: -11110,
              },
            ],
            impact: { activeSponsorships: 1, adoptedAnimals: 0, availableAnimals: 6 },
          },
        ],
      },
    }),
  },

  // Central de serviços — público
  '/api/it-services': {
    get: op({
      tag: 'Central de serviços',
      summary: 'Catálogo de serviços de TI (S01–S08) e tabela de SLA',
      responses: {
        '200': [
          'Catálogo',
          {
            services: [
              {
                code: 'S01',
                name: 'Loja do bazar online',
                owner: 'Coordenação do bazar',
                availabilityTarget: 99.5,
              },
            ],
            sla: { P1: { responseMinutes: 30, resolutionMinutes: 240, continuous: true } },
            businessHours: {
              days: 'seg–sex',
              start: '08:00',
              end: '18:00',
              timezone: 'America/Fortaleza',
            },
          },
        ],
      },
    }),
  },
  '/api/tickets': {
    post: op({
      tag: 'Central de serviços',
      summary: 'Abre chamado pelo portal (sem login). Prioridade = matriz impacto × urgência',
      body: s.createTicketSchema,
      bodyExample: {
        serviceCode: 'S01',
        type: 'INCIDENT',
        title: 'Checkout não abre',
        description: 'Ao clicar em finalizar compra a página fica em branco.',
        requesterName: 'Carla',
        requesterEmail: 'carla@example.com',
        impact: 'HIGH',
        urgency: 'MEDIUM',
      },
      responses: {
        '201': [
          'Chamado aberto',
          {
            protocol: 'CH-2026-7K2QXA',
            priority: 'P2',
            status: 'OPEN',
            responseDueAt: '2026-11-25T16:00:00.000Z',
            resolutionDueAt: '2026-11-26T15:00:00.000Z',
          },
        ],
      },
    }),
    get: op({
      tag: 'Central de serviços (interno)',
      summary: 'Fila de chamados com indicador de SLA (ON_TRACK, AT_RISK, VIOLATED, MET)',
      auth: 'jwt',
      query: s.ticketFiltersSchema,
      responses: { '200': ['Página de chamados', page([ticketExample])] },
    }),
  },
  '/api/tickets/protocol/{protocol}': {
    get: op({
      tag: 'Central de serviços',
      summary: 'Acompanhamento público pelo protocolo',
      params: [pathParam('protocol', 'Protocolo', 'CH-2026-7K2QXA')],
      responses: { '200': ['Chamado (sem dados pessoais)'] },
      errors: { '404': errorResponse('Não encontrado', 'NOT_FOUND') },
    }),
  },
  '/api/tickets/protocol/{protocol}/reply': {
    post: op({
      tag: 'Central de serviços',
      summary: 'Resposta do solicitante (WAITING_USER volta para IN_PROGRESS)',
      params: [pathParam('protocol', 'Protocolo')],
      body: s.requesterReplySchema,
      bodyExample: { email: 'carla@example.com', message: 'Uso o Chrome no Android.' },
      responses: { '200': ['Chamado atualizado'] },
      errors: { '404': errorResponse('Não encontrado para este e-mail', 'NOT_FOUND') },
    }),
  },

  // Central de serviços — interno
  '/api/tickets/internal': {
    post: op({
      tag: 'Central de serviços (interno)',
      summary: 'Abre chamado interno (inclui tipo PROBLEM)',
      auth: 'jwt',
      body: s.createInternalTicketSchema,
      responses: { '201': ['Chamado criado', ticketExample] },
    }),
  },
  '/api/tickets/sla-report': {
    get: op({
      tag: 'Central de serviços (interno)',
      summary: 'Relatório de SLA do período',
      description:
        'Total por prioridade, % dentro do prazo de resposta e de resolução, tempos médios, quebra por serviço e lista de chamados violados.',
      auth: 'jwt',
      query: s.slaReportQuerySchema,
      responses: {
        '200': [
          'Relatório',
          {
            period: { from: '2026-11-01T00:00:00.000Z', to: '2026-11-30T00:00:00.000Z' },
            overall: {
              total: 40,
              response: { met: 32, violated: 7, pending: 1, compliancePct: 82.1, avgMinutes: 610 },
              resolution: {
                met: 30,
                violated: 4,
                pending: 6,
                compliancePct: 88.2,
                avgMinutes: 2900,
              },
            },
            byPriority: {
              P1: { total: 5, response: { compliancePct: 80 }, resolution: { compliancePct: 80 } },
            },
            byService: [{ code: 'S01', name: 'Loja do bazar online', total: 12, violated: 3 }],
            violations: [
              {
                protocol: 'CH-2026-AB12CD',
                title: 'Checkout fora do ar',
                priority: 'P1',
                service: 'S01',
                violated: ['RESOLUTION'],
              },
            ],
          },
        ],
      },
    }),
  },
  '/api/tickets/{id}': {
    get: op({
      tag: 'Central de serviços (interno)',
      summary: 'Detalhe do chamado com histórico, problema e incidentes vinculados',
      auth: 'jwt',
      params: [idParam],
      responses: {
        '200': [
          'Chamado',
          {
            ...ticketExample,
            events: [
              { type: 'CREATED', message: 'Chamado aberto (impacto HIGH, urgência MEDIUM → P2)' },
            ],
          },
        ],
      },
    }),
  },
  '/api/tickets/{id}/status': {
    patch: op({
      tag: 'Central de serviços (interno)',
      summary: 'Muda status (registra 1ª resposta; RESOLVED/CLOSED marcam datas)',
      auth: 'jwt',
      params: [idParam],
      body: s.updateTicketStatusSchema,
      bodyExample: { status: 'WAITING_USER', message: 'Qual navegador você usa?' },
      responses: { '200': ['Chamado atualizado'] },
      errors: { '409': errorResponse('Transição inválida', 'INVALID_TRANSITION') },
    }),
  },
  '/api/tickets/{id}/escalate': {
    post: op({
      tag: 'Central de serviços (interno)',
      summary: 'Escalonamento N1 → N2 → N3 (registra TicketEvent)',
      auth: 'jwt',
      params: [idParam],
      body: s.escalateTicketSchema,
      bodyExample: { toLevel: 'N2', reason: 'Requer acesso ao servidor' },
      responses: { '200': ['Chamado escalonado'] },
      errors: { '409': errorResponse('Nível igual ou inferior ao atual', 'INVALID_ESCALATION') },
    }),
  },
  '/api/tickets/{id}/assign': {
    post: op({
      tag: 'Central de serviços (interno)',
      summary: 'Atribui responsável (null remove)',
      auth: 'jwt',
      params: [idParam],
      body: s.assignTicketSchema,
      responses: { '200': ['Chamado atualizado'] },
    }),
  },
  '/api/tickets/{id}/comments': {
    post: op({
      tag: 'Central de serviços (interno)',
      summary: 'Comentário da equipe (notifica o solicitante)',
      auth: 'jwt',
      params: [idParam],
      body: s.commentTicketSchema,
      responses: { '200': ['Chamado atualizado'] },
    }),
  },
  '/api/tickets/{id}/problem': {
    post: op({
      tag: 'Central de serviços (interno)',
      summary: 'Vincula incidente a um problema (gerenciamento de problemas)',
      auth: 'jwt',
      params: [idParam],
      body: s.linkProblemSchema,
      responses: { '200': ['Chamado atualizado'] },
    }),
  },

  // Webhooks e simulador
  '/api/webhooks/mercadopago': {
    post: op({
      tag: 'Integrações — webhooks',
      summary: 'Webhook do Mercado Pago (pagamentos e assinaturas)',
      description:
        '1) Valida `x-signature` (HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`). ' +
        '2) Registra `WebhookEvent` com chave única — notificação repetida responde `duplicate`. ' +
        '3) Consulta o recurso no gateway (não confia no corpo). 4) Aplica a transição de status de forma idempotente. ' +
        'Tipos tratados: `payment`, `subscription_preapproval`, `subscription_authorized_payment`.',
      params: [
        {
          name: 'data.id',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          example: '1234567890',
        },
        {
          name: 'type',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          example: 'payment',
        },
        {
          name: 'x-signature',
          in: 'header',
          required: true,
          schema: { type: 'string' },
          example: 'ts=1764000000000,v1=8f0c...',
        },
        { name: 'x-request-id', in: 'header', required: true, schema: { type: 'string' } },
      ],
      body: { type: 'object' },
      bodyExample: {
        id: 12345,
        type: 'payment',
        action: 'payment.updated',
        data: { id: '1234567890' },
      },
      responses: {
        '200': ['Recebido', { received: true, status: 'processed', eventId: 'cmwmwh...' }],
      },
      errors: {
        '401': errorResponse(
          'Assinatura inválida',
          'INVALID_SIGNATURE',
          'Assinatura do webhook inválida',
        ),
        '422': errorResponse('Valor pago diverge do cobrado', 'AMOUNT_MISMATCH'),
      },
    }),
  },
  '/api/dev/payments/{id}/simulate': {
    post: op({
      tag: 'Integrações — simulador (mock)',
      summary: 'Simula aprovação/recusa de um pagamento disparando o MESMO fluxo do webhook',
      description:
        'Disponível somente com `INTEGRATIONS_MODE=mock`. Gera uma notificação assinada e a processa como o webhook real.',
      params: [pathParam('id', 'id do pagamento (campo payment.id do pedido/doação)')],
      body: z.object({ status: z.enum(['APPROVED', 'REJECTED']) }),
      bodyExample: { status: 'APPROVED' },
      responses: {
        '200': [
          'Simulado',
          {
            webhook: { status: 'processed' },
            payment: {
              ...paymentPixExample,
              status: 'APPROVED',
              paidAt: '2026-11-25T15:02:00.000Z',
            },
          },
        ],
      },
      errors: {
        '404': errorResponse('Simulador desativado ou pagamento inexistente', 'NOT_FOUND'),
      },
    }),
  },
  '/api/dev/sponsorships/{id}/simulate': {
    post: op({
      tag: 'Integrações — simulador (mock)',
      summary: 'Simula eventos da assinatura: AUTHORIZE (ativa), CHARGE (mensalidade), CANCEL',
      params: [idParam],
      body: z.object({ event: z.enum(['AUTHORIZE', 'CHARGE', 'CANCEL']) }),
      bodyExample: { event: 'AUTHORIZE' },
      responses: {
        '200': [
          'Simulado',
          { webhook: { status: 'processed' }, sponsorship: { id: 'cmwmsp...', status: 'ACTIVE' } },
        ],
      },
    }),
  },

  // API pública
  '/api/public/v1/animals': {
    get: op({
      tag: 'API pública v1 (parceiros)',
      summary: 'Animais disponíveis para adoção',
      auth: 'apiKey',
      query: s.paginationSchema.extend({
        species: z.enum(s.Species).optional(),
        size: z.enum(s.AnimalSizes).optional(),
      }),
      responses: {
        '200': [
          'Animais',
          {
            data: [
              {
                id: 'caramelo',
                name: 'Caramelo',
                species: 'DOG',
                ageMonths: 24,
                size: 'MEDIUM',
                status: 'AVAILABLE',
                adoptUrl: 'https://.../adote/caramelo',
                sponsorUrl: 'https://.../doe/apadrinhar/caramelo',
              },
            ],
            page: 1,
            pageSize: 20,
            total: 1,
          },
        ],
      },
    }),
  },
  '/api/public/v1/animals/{id}': {
    get: op({
      tag: 'API pública v1 (parceiros)',
      summary: 'Detalhe de um animal',
      auth: 'apiKey',
      params: [pathParam('id', 'Identificador público (slug)', 'caramelo')],
      responses: { '200': ['Animal'] },
      errors: { '404': errorResponse('Não encontrado ou já adotado', 'NOT_FOUND') },
    }),
  },
  '/api/public/v1/campaigns': {
    get: op({
      tag: 'API pública v1 (parceiros)',
      summary: 'Campanhas ativas',
      auth: 'apiKey',
      responses: {
        '200': [
          'Campanhas',
          {
            data: [
              {
                id: 'mutirao-castracao-2026',
                title: 'Mutirão de castração 2026',
                goalCents: 900000,
                raisedCents: 125000,
                progressPct: 14,
                donateUrl: 'https://.../doe?campanha=mutirao-castracao-2026',
              },
            ],
          },
        ],
      },
    }),
  },

  // Admin
  '/api/admin/dashboard': {
    get: op({
      tag: 'Admin',
      summary: 'Indicadores do mês (vendas, doações, padrinhos, adoções, chamados, outbox)',
      auth: 'jwt',
      responses: {
        '200': [
          'Dashboard',
          {
            sales: { count: 3, totalCents: 12000 },
            donations: { count: 8, totalCents: 32000 },
            sponsorships: { active: 4, monthCents: 20000 },
            tickets: {
              open: 6,
              byPriority: { P1: 0, P2: 2, P3: 1, P4: 3 },
              bySla: { ON_TRACK: 4, AT_RISK: 1, VIOLATED: 1 },
            },
            notifications: { pending: 0, failed: 0 },
          },
        ],
      },
    }),
  },
  '/api/admin/animals': {
    get: op({
      tag: 'Admin — catálogo',
      summary: 'Lista animais (todos os status)',
      auth: 'jwt',
      query: s.animalFiltersSchema,
      responses: { '200': ['Página', page([animalExample])] },
    }),
    post: op({
      tag: 'Admin — catálogo',
      summary: 'Cadastra animal (slug gerado do nome)',
      auth: 'jwt',
      body: s.animalInputSchema,
      responses: { '201': ['Criado', animalExample] },
    }),
  },
  '/api/admin/animals/{id}': {
    patch: op({
      tag: 'Admin — catálogo',
      summary: 'Atualiza animal',
      auth: 'jwt',
      params: [idParam],
      body: s.animalInputSchema.partial(),
      responses: { '200': ['Atualizado'] },
    }),
    delete: op({
      tag: 'Admin — catálogo',
      summary: 'Exclui animal sem vínculos',
      auth: 'jwt',
      params: [idParam],
      responses: { '204': ['Excluído'] },
      errors: { '409': errorResponse('Possui adoções/apadrinhamentos', 'CONFLICT') },
    }),
  },
  '/api/admin/products': {
    get: op({
      tag: 'Admin — catálogo',
      summary: 'Lista peças (todos os status)',
      auth: 'jwt',
      query: s.productFiltersSchema,
      responses: { '200': ['Página', page([productExample])] },
    }),
    post: op({
      tag: 'Admin — catálogo',
      summary: 'Cadastra peça',
      auth: 'jwt',
      body: s.productInputSchema,
      responses: { '201': ['Criada', productExample] },
    }),
  },
  '/api/admin/products/{id}': {
    patch: op({
      tag: 'Admin — catálogo',
      summary: 'Atualiza peça',
      auth: 'jwt',
      params: [idParam],
      body: s.productInputSchema.partial(),
      responses: { '200': ['Atualizada'] },
    }),
    delete: op({
      tag: 'Admin — catálogo',
      summary: 'Exclui peça (ou oculta, se já teve pedidos)',
      auth: 'jwt',
      params: [idParam],
      responses: { '200': ['Resultado', { hidden: true }] },
    }),
  },
  '/api/admin/campaigns': {
    get: op({
      tag: 'Admin — catálogo',
      summary: 'Lista campanhas',
      auth: 'jwt',
      responses: { '200': ['Campanhas'] },
    }),
    post: op({
      tag: 'Admin — catálogo',
      summary: 'Cria campanha',
      auth: 'jwt',
      body: s.campaignInputSchema,
      responses: { '201': ['Criada'] },
    }),
  },
  '/api/admin/campaigns/{id}': {
    patch: op({
      tag: 'Admin — catálogo',
      summary: 'Atualiza campanha',
      auth: 'jwt',
      params: [idParam],
      body: s.campaignInputSchema.partial(),
      responses: { '200': ['Atualizada'] },
    }),
  },
  '/api/admin/orders': {
    get: op({
      tag: 'Admin — pedidos',
      summary: 'Lista pedidos',
      auth: 'jwt',
      query: s.orderFiltersSchema,
      responses: { '200': ['Página', page([orderExample])] },
    }),
  },
  '/api/admin/orders/{id}': {
    get: op({
      tag: 'Admin — pedidos',
      summary: 'Detalhe do pedido',
      auth: 'jwt',
      params: [idParam],
      responses: { '200': ['Pedido', orderExample] },
    }),
  },
  '/api/admin/orders/{id}/status': {
    patch: op({
      tag: 'Admin — pedidos',
      summary: 'Muda status (PAID → SHIPPED → DELIVERED, ou CANCELED) e notifica o comprador',
      auth: 'jwt',
      params: [idParam],
      body: s.updateOrderStatusSchema,
      bodyExample: { status: 'SHIPPED', trackingCode: 'BR123456789BR' },
      responses: { '200': ['Pedido atualizado'] },
      errors: { '409': errorResponse('Transição inválida', 'INVALID_TRANSITION') },
    }),
  },
  '/api/admin/adoptions': {
    get: op({
      tag: 'Admin — adoções',
      summary: 'Lista solicitações de adoção',
      auth: 'jwt',
      query: s.paginationSchema.extend({ status: z.enum(s.AdoptionStatuses).optional() }),
      responses: { '200': ['Página'] },
    }),
  },
  '/api/admin/adoptions/{id}': {
    get: op({
      tag: 'Admin — adoções',
      summary: 'Detalhe com questionário',
      auth: 'jwt',
      params: [idParam],
      responses: { '200': ['Solicitação'] },
    }),
  },
  '/api/admin/adoptions/{id}/status': {
    patch: op({
      tag: 'Admin — adoções',
      summary: 'Triagem: RECEIVED → IN_REVIEW → INTERVIEW → APPROVED (ou REJECTED)',
      description: 'APPROVED marca o animal como ADOPTED e recusa as demais solicitações abertas.',
      auth: 'jwt',
      params: [idParam],
      body: s.updateAdoptionStatusSchema,
      responses: { '200': ['Atualizada'] },
      errors: { '409': errorResponse('Transição inválida', 'INVALID_TRANSITION') },
    }),
  },
  '/api/admin/expenses': {
    get: op({
      tag: 'Admin — tesouraria',
      summary: 'Lista despesas',
      auth: 'jwt',
      query: s.paginationSchema.extend({ category: z.enum(s.ExpenseCategories).optional() }),
      responses: { '200': ['Página'] },
    }),
    post: op({
      tag: 'Admin — tesouraria',
      summary: 'Registra despesa',
      auth: 'jwt',
      body: s.expenseInputSchema,
      bodyExample: {
        category: 'RACAO',
        description: 'Ração 15 kg x 4',
        amountCents: 48000,
        spentAt: '2026-11-10',
      },
      responses: { '201': ['Criada'] },
    }),
  },
  '/api/admin/expenses/{id}': {
    patch: op({
      tag: 'Admin — tesouraria',
      summary: 'Atualiza despesa',
      auth: 'jwt',
      params: [idParam],
      body: s.expenseInputSchema.partial(),
      responses: { '200': ['Atualizada'] },
    }),
    delete: op({
      tag: 'Admin — tesouraria',
      summary: 'Exclui despesa',
      auth: 'jwt',
      params: [idParam],
      responses: { '204': ['Excluída'] },
    }),
  },
  '/api/admin/donations': {
    get: op({
      tag: 'Admin — tesouraria',
      summary: 'Lista doações',
      auth: 'jwt',
      query: s.paginationSchema,
      responses: { '200': ['Página'] },
    }),
  },
  '/api/admin/sponsorships': {
    get: op({
      tag: 'Admin — tesouraria',
      summary: 'Lista apadrinhamentos',
      auth: 'jwt',
      query: s.paginationSchema.extend({ status: z.enum(s.SponsorshipStatuses).optional() }),
      responses: { '200': ['Página'] },
    }),
  },
  '/api/admin/sponsorships/{id}/cancel': {
    post: op({
      tag: 'Admin — tesouraria',
      summary: 'Cancela apadrinhamento (também no gateway)',
      auth: 'jwt',
      params: [idParam],
      responses: { '200': ['Cancelado'] },
    }),
  },
  '/api/admin/partners': {
    get: op({
      tag: 'Admin — parceiros',
      summary: 'Lista parceiros da API pública',
      auth: 'jwt',
      responses: {
        '200': [
          'Parceiros',
          [
            {
              id: 'cmwm...',
              name: 'Pet Shop Parceiro',
              apiKeyPrefix: 'bz_live_6b20',
              active: true,
              lastUsedAt: null,
            },
          ],
        ],
      },
    }),
    post: op({
      tag: 'Admin — parceiros',
      summary: 'Cadastra parceiro e gera chave de API (exibida uma única vez)',
      auth: 'jwt',
      body: s.createPartnerSchema,
      responses: {
        '201': [
          'Criado',
          {
            id: 'cmwm...',
            name: 'Pet Shop',
            apiKeyPrefix: 'bz_live_6b20',
            apiKey: 'bz_live_6b20...',
            warning: 'Guarde esta chave: ela não será exibida novamente.',
          },
        ],
      },
    }),
  },
  '/api/admin/partners/{id}/rotate-key': {
    post: op({
      tag: 'Admin — parceiros',
      summary: 'Gera nova chave (a anterior para de funcionar)',
      auth: 'jwt',
      params: [idParam],
      responses: { '200': ['Nova chave'] },
    }),
  },
  '/api/admin/partners/{id}/revoke': {
    post: op({
      tag: 'Admin — parceiros',
      summary: 'Revoga a chave do parceiro',
      auth: 'jwt',
      params: [idParam],
      responses: { '200': ['Revogado'] },
    }),
  },
  '/api/admin/users': {
    get: op({
      tag: 'Admin — acessos',
      summary: 'Lista usuários internos (S06 — gestão de acessos)',
      auth: 'jwt',
      responses: { '200': ['Usuários'] },
    }),
    post: op({
      tag: 'Admin — acessos',
      summary: 'Cria usuário',
      auth: 'jwt',
      body: s.createUserSchema,
      responses: { '201': ['Criado'] },
      errors: { '409': errorResponse('E-mail já cadastrado', 'CONFLICT') },
    }),
  },
  '/api/admin/users/assignable': {
    get: op({
      tag: 'Admin — acessos',
      summary: 'Usuários ativos para atribuição de chamados',
      auth: 'jwt',
      responses: { '200': ['Usuários'] },
    }),
  },
  '/api/admin/users/{id}': {
    patch: op({
      tag: 'Admin — acessos',
      summary: 'Atualiza papel, status ou senha',
      auth: 'jwt',
      params: [idParam],
      body: s.updateUserSchema,
      responses: { '200': ['Atualizado'] },
    }),
  },
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Bazar Solidário Digital — API',
    version: '1.0.0',
    description: [
      'API da plataforma Bazar Solidário Digital — Projeto de Extensão V (Sistemas de Informação, UNI-RN).',
      'Entidade **simulada** para fins acadêmicos: Associação Patas Potiguares.',
      '',
      '- Valores monetários em **centavos** (inteiros).',
      '- Toda resposta traz `x-correlation-id` (enviado pelo cliente ou gerado) — o mesmo id aparece nos logs.',
      '- Erros: `{ "error": { "code", "message", "details?" } }` com mensagens em pt-BR.',
      '- Rotas internas: `Authorization: Bearer <JWT>` (POST /api/auth/login). API pública: header `x-api-key`.',
      '- Com `INTEGRATIONS_MODE=mock`, use as rotas de **simulador** para aprovar pagamentos sem gateway real.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'Servidor atual' }],
  tags: [
    { name: 'Observabilidade' },
    { name: 'Autenticação' },
    { name: 'Catálogo', description: 'Animais, peças do bazar e campanhas' },
    { name: 'Frete e CEP', description: 'I02 Melhor Envio e I03 ViaCEP' },
    { name: 'Bazar — pedidos' },
    { name: 'Doações e apadrinhamento' },
    { name: 'Adoção' },
    { name: 'Transparência' },
    { name: 'Central de serviços', description: 'ITIL — abertura e acompanhamento públicos' },
    {
      name: 'Central de serviços (interno)',
      description: 'Fila, SLA, escalonamento, problemas e relatório',
    },
    { name: 'Integrações — webhooks', description: 'I01 Mercado Pago' },
    { name: 'Integrações — simulador (mock)' },
    {
      name: 'API pública v1 (parceiros)',
      description: 'I05 — somente leitura, x-api-key, 60 req/min',
    },
    { name: 'Admin' },
    { name: 'Admin — catálogo' },
    { name: 'Admin — pedidos' },
    { name: 'Admin — adoções' },
    { name: 'Admin — tesouraria' },
    { name: 'Admin — parceiros' },
    { name: 'Admin — acessos' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    },
    parameters: {
      CorrelationId: {
        name: 'x-correlation-id',
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Identificador de rastreio (gerado se ausente; devolvido na resposta)',
      },
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        schema: { type: 'string', pattern: '^[\\w-]{8,100}$' },
        description:
          'Repetir a requisição com a mesma chave devolve o mesmo recurso, sem nova cobrança',
        example: '3f1c2a9e-2b7d-4f0a-9c1e-7a5b8d6e4f21',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Dados inválidos' },
              details: {},
            },
          },
        },
      },
    },
  },
  paths,
};
