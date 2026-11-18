import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { createPartnerSchema } from '@bazar/shared';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { hashApiKey } from '../../middlewares/api-key';
import { requireAuth, requireRole } from '../../middlewares/auth';

/** Gera uma chave de API. Só o hash é guardado; a chave em texto aparece uma única vez. */
export function generateApiKey() {
  const key = `bz_live_${randomBytes(24).toString('hex')}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

const select = {
  id: true,
  name: true,
  contactEmail: true,
  apiKeyPrefix: true,
  active: true,
  lastUsedAt: true,
  createdAt: true,
  revokedAt: true,
};

export const adminPartnerRoutes = Router();
adminPartnerRoutes.use(requireAuth, requireRole('ADMIN'));

adminPartnerRoutes.get('/', async (_req, res) => {
  res.json(await prisma.partner.findMany({ select, orderBy: { createdAt: 'desc' } }));
});

adminPartnerRoutes.post('/', async (req, res) => {
  const input = createPartnerSchema.parse(req.body);
  const { key, prefix, hash } = generateApiKey();
  const partner = await prisma.partner.create({
    data: { ...input, apiKeyPrefix: prefix, apiKeyHash: hash },
    select,
  });
  res
    .status(201)
    .json({
      ...partner,
      apiKey: key,
      warning: 'Guarde esta chave: ela não será exibida novamente.',
    });
});

/** Gera nova chave (a anterior deixa de funcionar imediatamente). */
adminPartnerRoutes.post('/:id/rotate-key', async (req, res) => {
  const existing = await prisma.partner.findUnique({ where: { id: req.params.id } });
  if (!existing) throw AppError.notFound('Parceiro não encontrado');
  const { key, prefix, hash } = generateApiKey();
  const partner = await prisma.partner.update({
    where: { id: existing.id },
    data: { apiKeyPrefix: prefix, apiKeyHash: hash, active: true, revokedAt: null },
    select,
  });
  res.json({
    ...partner,
    apiKey: key,
    warning: 'Guarde esta chave: ela não será exibida novamente.',
  });
});

adminPartnerRoutes.post('/:id/revoke', async (req, res) => {
  const existing = await prisma.partner.findUnique({ where: { id: req.params.id } });
  if (!existing) throw AppError.notFound('Parceiro não encontrado');
  res.json(
    await prisma.partner.update({
      where: { id: existing.id },
      data: { active: false, revokedAt: new Date() },
      select,
    }),
  );
});
