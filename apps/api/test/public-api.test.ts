import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { adminToken, createAnimal, resetDb } from './helpers';

const app = createApp({ publicApiRateLimit: 5 });
let apiKey: string;
let partnerId: string;

beforeEach(async () => {
  await resetDb();
  const { token } = await adminToken();
  const res = await request(app)
    .post('/api/admin/partners')
    .set('authorization', `Bearer ${token}`)
    .send({ name: 'Pet Shop', contactEmail: 'pet@test.dev' });
  apiKey = res.body.apiKey;
  partnerId = res.body.id;
  await createAnimal({ slug: 'rex' });
  await createAnimal({ slug: 'adotado', status: 'ADOPTED' });
});
afterAll(() => prisma.$disconnect());

describe('API pública /api/public/v1 (I05)', () => {
  it('exige x-api-key', async () => {
    const res = await request(app).get('/api/public/v1/animals');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('API_KEY_REQUIRED');
  });

  it('rejeita chave inválida', async () => {
    const res = await request(app).get('/api/public/v1/animals').set('x-api-key', 'bz_live_errada');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
  });

  it('lista animais disponíveis (sem adotados) com link de adoção', async () => {
    const res = await request(app).get('/api/public/v1/animals').set('x-api-key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      id: 'rex',
      adoptUrl: expect.stringContaining('/adote/rex'),
    });
    expect(res.headers['ratelimit-policy']).toBeDefined();
    expect(
      (await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } })).apiKeyHash,
    ).not.toContain(apiKey);
  });

  it('animal adotado não aparece no detalhe', async () => {
    expect(
      (await request(app).get('/api/public/v1/animals/adotado').set('x-api-key', apiKey)).status,
    ).toBe(404);
  });

  it('lista campanhas ativas', async () => {
    const res = await request(app).get('/api/public/v1/campaigns').set('x-api-key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('aplica rate limit por chave (429)', async () => {
    const statuses = [];
    for (let i = 0; i < 7; i++)
      statuses.push(
        (await request(app).get('/api/public/v1/campaigns').set('x-api-key', apiKey)).status,
      );
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });

  it('chave revogada deixa de funcionar', async () => {
    const { token } = await adminToken();
    await request(app)
      .post(`/api/admin/partners/${partnerId}/revoke`)
      .set('authorization', `Bearer ${token}`);
    expect((await request(app).get('/api/public/v1/animals').set('x-api-key', apiKey)).status).toBe(
      401,
    );
  });

  it('somente leitura: POST não existe', async () => {
    expect(
      (await request(app).post('/api/public/v1/animals').set('x-api-key', apiKey)).status,
    ).toBe(404);
  });
});
