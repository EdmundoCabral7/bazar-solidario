/**
 * Especificação OpenAPI 3 da API. Servida em GET /docs e exportada para docs/openapi.json.
 * Cada módulo novo deve acrescentar seus paths aqui.
 */
const errorSchema = {
  type: 'object',
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
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Bazar Solidário Digital — API',
    version: '0.1.0',
    description:
      'API da plataforma Bazar Solidário Digital (Projeto de Extensão V — UNI-RN). ' +
      'Entidade simulada para fins acadêmicos: Associação Patas Potiguares.\n\n' +
      'Toda resposta traz o header `x-correlation-id` (enviado pelo cliente ou gerado).',
  },
  servers: [{ url: '/', description: 'Servidor atual' }],
  tags: [
    { name: 'Observabilidade', description: 'Saúde e métricas' },
    { name: 'Autenticação', description: 'Login de voluntários e administradores' },
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
        description: 'Identificador de rastreio da requisição',
      },
    },
    schemas: {
      Error: errorSchema,
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clx1abc...' },
          name: { type: 'string', example: 'Administrador(a) Demo' },
          email: { type: 'string', example: 'admin@pataspotiguares.org' },
          role: { type: 'string', enum: ['ADMIN', 'VOLUNTEER', 'SUPPORT_N2'] },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Observabilidade'],
        summary: 'Status da API, banco e integrações',
        responses: {
          '200': {
            description: 'Tudo operacional',
            content: {
              'application/json': {
                example: {
                  status: 'ok',
                  timestamp: '2026-11-19T12:00:00.000Z',
                  database: { status: 'up', latencyMs: 3 },
                  integrations: [{ name: 'mercadopago', mode: 'mock', status: 'up' }],
                },
              },
            },
          },
          '503': { description: 'Banco de dados indisponível' },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Observabilidade'],
        summary: 'Contadores básicos da API',
        responses: {
          '200': {
            description: 'Métricas',
            content: {
              'application/json': {
                example: {
                  uptimeSeconds: 120,
                  requestsTotal: 42,
                  responses2xx: 40,
                  responses4xx: 2,
                  responses5xx: 0,
                  memoryRssBytes: 80000000,
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Autentica um usuário interno e retorna um JWT',
        parameters: [{ $ref: '#/components/parameters/CorrelationId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
              example: { email: 'admin@pataspotiguares.org', password: 'admin123' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login efetuado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Dados inválidos',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Credenciais incorretas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' },
                },
              },
            },
          },
          '429': { description: 'Muitas tentativas' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Autenticação'],
        summary: 'Dados do usuário autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Usuário',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          '401': {
            description: 'Sem token ou token inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
} as const;
