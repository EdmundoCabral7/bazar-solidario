import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireAuth, requireRole, signToken } from '../src/middlewares/auth';
import { errorHandler } from '../src/middlewares/error-handler';

const app = express();
app.get('/admin', requireAuth, requireRole('ADMIN'), (_req, res) => res.json({ ok: true }));
app.use(errorHandler);

describe('requireRole', () => {
  it('permite ADMIN', async () => {
    const token = signToken({ id: '1', email: 'a@a.com', role: 'ADMIN' });
    const res = await request(app).get('/admin').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('bloqueia VOLUNTEER com 403', async () => {
    const token = signToken({ id: '2', email: 'v@a.com', role: 'VOLUNTEER' });
    const res = await request(app).get('/admin').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
