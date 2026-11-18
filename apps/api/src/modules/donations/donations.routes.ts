import { Router } from 'express';
import { createDonationSchema } from '@bazar/shared';
import { readIdempotencyKey } from '../../middlewares/idempotency';
import { paymentLimiter } from '../../middlewares/rate-limit';
import * as service from './donations.service';

export const donationRoutes = Router();

donationRoutes.post('/', paymentLimiter, async (req, res) => {
  const input = createDonationSchema.parse(req.body);
  const { replayed, donation } = await service.createDonation(input, readIdempotencyKey(req));
  if (replayed) res.setHeader('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(donation);
});

donationRoutes.get('/:id', async (req, res) => {
  res.json(await service.getDonation(req.params.id));
});
