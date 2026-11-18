import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { openapiSpec } from '../src/docs/openapi';
import { prisma } from '../src/lib/prisma';

const app = createApp();
afterAll(() => prisma.$disconnect());

type Method = 'get' | 'post' | 'patch' | 'delete';
const operations = Object.entries(
  openapiSpec.paths as Record<string, Record<string, unknown>>,
).flatMap(([path, methods]) =>
  Object.keys(methods).map((method) => ({ method: method as Method, path })),
);

describe('documentação OpenAPI', () => {
  it('documenta todas as áreas da API', () => {
    expect(operations.length).toBeGreaterThanOrEqual(70);
  });

  it.each(operations)('$method $path existe na aplicação', async ({ method, path }) => {
    const url = path.replace(/\{[^}]+\}/g, 'x');
    const res = await request(app)[method](url).send({});
    // pode falhar por validação/auth/404 de recurso, mas não por rota inexistente
    expect(res.body?.error?.message ?? '').not.toMatch(/^Rota .* não encontrada$/);
  });

  it('toda operação tem resumo e respostas', () => {
    for (const methods of Object.values(
      openapiSpec.paths as Record<string, Record<string, { summary?: string; responses?: object }>>,
    )) {
      for (const op of Object.values(methods)) {
        expect(op.summary).toBeTruthy();
        expect(Object.keys(op.responses ?? {}).length).toBeGreaterThan(0);
      }
    }
  });
});
