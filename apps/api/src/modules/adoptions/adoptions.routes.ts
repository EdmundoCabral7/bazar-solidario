import { Router } from 'express';
import { z } from 'zod';
import {
  AdoptionStatuses,
  createAdoptionSchema,
  paginationSchema,
  updateAdoptionStatusSchema,
} from '@bazar/shared';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { formLimiter } from '../../middlewares/rate-limit';
import * as service from './adoptions.service';

export const adoptionRoutes = Router();

adoptionRoutes.post('/', formLimiter, async (req, res) => {
  res.status(201).json(await service.createAdoption(createAdoptionSchema.parse(req.body)));
});
adoptionRoutes.get('/:code', async (req, res) => {
  res.json(await service.getAdoptionByCode(req.params.code));
});

export const adminAdoptionRoutes = Router();
adminAdoptionRoutes.use(requireAuth, requireRole('ADMIN', 'VOLUNTEER'));

const filters = paginationSchema.extend({ status: z.enum(AdoptionStatuses).optional() });

adminAdoptionRoutes.get('/', async (req, res) => {
  res.json(await service.listAdoptions(filters.parse(req.query)));
});
adminAdoptionRoutes.get('/:id', async (req, res) => {
  res.json(await service.getAdoption(req.params.id));
});
adminAdoptionRoutes.patch('/:id/status', async (req, res) => {
  const { status, notes } = updateAdoptionStatusSchema.parse(req.body);
  res.json(await service.updateAdoptionStatus(req.params.id, status, notes));
});
