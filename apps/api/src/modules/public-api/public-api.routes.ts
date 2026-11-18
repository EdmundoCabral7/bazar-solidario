import { Router } from 'express';
import { z } from 'zod';
import { AnimalSizes, paginationSchema, Species } from '@bazar/shared';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireApiKey } from '../../middlewares/api-key';
import { publicApiLimiter } from '../../middlewares/rate-limit';
import { listCampaigns } from '../catalog/catalog.service';

/**
 * I05 — API pública para parceiros (pet shops, clínicas): somente leitura, autenticada por
 * x-api-key e limitada a 60 req/min por chave. Respostas estáveis (v1) e sem dados pessoais.
 */
export function createPublicApiRoutes(limit = 60) {
  const r = Router();
  r.use(requireApiKey, publicApiLimiter(limit));

  const animalFilters = paginationSchema.extend({
    species: z.enum(Species).optional(),
    size: z.enum(AnimalSizes).optional(),
  });

  const presentAnimal = (a: {
    slug: string;
    name: string;
    species: string;
    ageMonths: number;
    size: string;
    sex: string;
    neutered: boolean;
    vaccinated: boolean;
    description: string;
    photos: string[];
    status: string;
  }) => ({
    id: a.slug,
    name: a.name,
    species: a.species,
    ageMonths: a.ageMonths,
    size: a.size,
    sex: a.sex,
    neutered: a.neutered,
    vaccinated: a.vaccinated,
    description: a.description,
    photos: a.photos,
    status: a.status,
    adoptUrl: `${env.WEB_URL}/adote/${a.slug}`,
    sponsorUrl: `${env.WEB_URL}/doe/apadrinhar/${a.slug}`,
  });

  r.get('/animals', async (req, res) => {
    const f = animalFilters.parse(req.query);
    const where = {
      species: f.species,
      size: f.size,
      status: { in: ['AVAILABLE', 'IN_ADOPTION'] as ('AVAILABLE' | 'IN_ADOPTION')[] },
    };
    const [rows, total] = await Promise.all([
      prisma.animal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      prisma.animal.count({ where }),
    ]);
    res.json({ data: rows.map(presentAnimal), page: f.page, pageSize: f.pageSize, total });
  });

  r.get('/animals/:id', async (req, res) => {
    const a = await prisma.animal.findUnique({ where: { slug: req.params.id } });
    if (!a || a.status === 'ADOPTED')
      throw AppError.notFound('Animal não encontrado ou já adotado');
    res.json(presentAnimal(a));
  });

  r.get('/campaigns', async (_req, res) => {
    const campaigns = await listCampaigns({ activeOnly: true });
    res.json({
      data: campaigns.map((c) => ({
        id: c.slug,
        title: c.title,
        description: c.description,
        goalCents: c.goalCents,
        raisedCents: c.raisedCents,
        progressPct: c.progressPct,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        donateUrl: `${env.WEB_URL}/doe?campanha=${c.slug}`,
      })),
    });
  });

  return r;
}
