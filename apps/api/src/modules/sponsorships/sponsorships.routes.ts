import { Router } from 'express';
import { cancelSponsorshipSchema, createSponsorshipSchema } from '@bazar/shared';
import { readIdempotencyKey } from '../../middlewares/idempotency';
import { paymentLimiter } from '../../middlewares/rate-limit';
import * as service from './sponsorships.service';

export const sponsorshipRoutes = Router();

sponsorshipRoutes.post('/', paymentLimiter, async (req, res) => {
  const input = createSponsorshipSchema.parse(req.body);
  const { replayed, sponsorship } = await service.createSponsorship(input, readIdempotencyKey(req));
  if (replayed) res.setHeader('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(sponsorship);
});

sponsorshipRoutes.get('/:id', async (req, res) => {
  res.json(await service.getSponsorship(req.params.id));
});

sponsorshipRoutes.post('/:id/cancel', paymentLimiter, async (req, res) => {
  const { email } = cancelSponsorshipSchema.parse(req.body);
  res.json(await service.cancelSponsorship(String(req.params.id), { email }));
});
