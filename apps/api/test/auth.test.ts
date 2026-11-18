import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { createUser } from './helpers';

const app = createApp();
const email = 'login-teste@test.dev';

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.dev' } } });
  await createUser({ email, password: 'senha123', role: 'ADMIN' });
  await createUser({ email: 'inativo@test.dev', password: 'senha123', active: false });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.dev' } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('autentica e retorna JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'senha123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email, role: 'ADMIN' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejeita senha errada', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'errada123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejeita usuário inativo', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inativo@test.dev', password: 'senha123' });
    expect(res.status).toBe(401);
  });

  it('valida o corpo com Zod', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveLength(2);
  });
});

describe('GET /api/auth/me', () => {
  it('exige token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejeita token inválido', async () => {
    const res = await request(app).get('/api/auth/me').set('authorization', 'Bearer abc');
    expect(res.status).toBe(401);
  });

  it('retorna o usuário do token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password: 'senha123' });
    const res = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });
});
