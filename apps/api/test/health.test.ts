import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const app = createApp();

describe('GET /health', () => {
  it('retorna status do banco e das integrações', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database.status).toBe('up');
    expect(res.body.integrations).toHaveLength(4);
  });

  it('propaga o x-correlation-id recebido', async () => {
    const res = await request(app).get('/health').set('x-correlation-id', 'teste-123');
    expect(res.headers['x-correlation-id']).toBe('teste-123');
  });

  it('gera x-correlation-id quando não enviado', async () => {
    const res = await request(app).get('/metrics');
    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.requestsTotal).toBeGreaterThan(0);
  });
});

describe('erros', () => {
  it('rota inexistente devolve 404 no formato padrão', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('JSON malformado devolve 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('serve a documentação OpenAPI', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
  });
});
