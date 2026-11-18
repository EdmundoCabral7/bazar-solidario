import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { adminToken, createAnimal, resetDb } from './helpers';

const app = createApp();
let token: string;

const answers = {
  housingType: 'HOUSE',
  ownsHome: true,
  hasYard: true,
  hasOtherPets: false,
  hasChildren: false,
  hoursAlonePerDay: 4,
  allResidentsAgree: true,
  canAffordCosts: true,
  motivation: 'Sempre tive cachorros e tenho espaço e tempo para cuidar.',
};
const body = (slug: string, email = 'pedro@test.dev') => ({
  animalSlug: slug,
  applicantName: 'Pedro Lima',
  applicantEmail: email,
  applicantPhone: '84988887777',
  city: 'Natal',
  answers,
  consent: true,
});

beforeEach(async () => {
  await resetDb();
  token = (await adminToken()).token;
});
afterAll(() => prisma.$disconnect());

describe('adoção', () => {
  it('cria solicitação com protocolo e bloqueia duplicada', async () => {
    const animal = await createAnimal({ slug: 'bob' });
    const res = await request(app).post('/api/adoptions').send(body(animal.slug));
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^ADO-/);
    const dup = await request(app).post('/api/adoptions').send(body(animal.slug));
    expect(dup.status).toBe(409);
    expect((await request(app).get(`/api/adoptions/${res.body.code}`)).body.status).toBe(
      'RECEIVED',
    );
  });

  it('triagem completa: animal vira ADOPTED e as demais solicitações são recusadas', async () => {
    const animal = await createAnimal({ slug: 'mel' });
    await request(app).post('/api/adoptions').send(body(animal.slug));
    await request(app).post('/api/adoptions').send(body(animal.slug, 'outra@test.dev'));
    const [first, second] = await prisma.adoptionRequest.findMany({
      orderBy: { applicantEmail: 'desc' },
    });
    const patch = (id: string, status: string) =>
      request(app)
        .patch(`/api/admin/adoptions/${id}/status`)
        .set('authorization', `Bearer ${token}`)
        .send({ status });

    await patch(first!.id, 'IN_REVIEW');
    await patch(first!.id, 'INTERVIEW');
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })).status).toBe(
      'IN_ADOPTION',
    );
    expect((await patch(first!.id, 'RECEIVED')).status).toBe(409);
    await patch(first!.id, 'APPROVED');

    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })).status).toBe(
      'ADOPTED',
    );
    expect(
      (await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: second!.id } })).status,
    ).toBe('REJECTED');
    expect(await prisma.notificationOutbox.count({ where: { template: 'ADOPTION_STATUS' } })).toBe(
      4,
    );
  });

  it('questionário exige concordância de todos os moradores e consentimento', async () => {
    const animal = await createAnimal();
    const res = await request(app)
      .post('/api/adoptions')
      .send({
        ...body(animal.slug),
        consent: false,
        answers: { ...answers, allResidentsAgree: false },
      });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['consent', 'answers.allResidentsAgree']));
  });
});
