import { Router } from 'express';
import { createOrderSchema, orderFiltersSchema, updateOrderStatusSchema } from '@bazar/shared';
import { requireAuth } from '../../middlewares/auth';
import { readIdempotencyKey } from '../../middlewares/idempotency';
import { paymentLimiter } from '../../middlewares/rate-limit';
import * as service from './orders.service';

export const orderRoutes = Router();

orderRoutes.post('/', paymentLimiter, async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const { replayed, order } = await service.createOrder(input, readIdempotencyKey(req));
  if (replayed) res.setHeader('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json(order);
});

orderRoutes.get('/:code', async (req, res) => {
  res.json(await service.getOrderByCode(req.params.code));
});

export const adminOrderRoutes = Router();
adminOrderRoutes.use(requireAuth);

adminOrderRoutes.get('/', async (req, res) => {
  res.json(await service.listOrders(orderFiltersSchema.parse(req.query)));
});
adminOrderRoutes.get('/:id', async (req, res) => {
  res.json(await service.getOrder(req.params.id));
});
adminOrderRoutes.patch('/:id/status', async (req, res) => {
  const { status, trackingCode } = updateOrderStatusSchema.parse(req.body);
  res.json(await service.updateOrderStatus(req.params.id, status, trackingCode));
});
