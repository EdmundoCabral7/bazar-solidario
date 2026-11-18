import { Router } from 'express';
import { cepSchema, shippingQuoteSchema } from '@bazar/shared';
import * as service from './shipping.service';

export const shippingRoutes = Router();

shippingRoutes.get('/cep/:cep', async (req, res) => {
  res.json(await service.lookupCep(cepSchema.parse(req.params.cep)));
});

shippingRoutes.post('/shipping/quote', async (req, res) => {
  const { cep, items } = shippingQuoteSchema.parse(req.body);
  res.json(await service.quoteShipping(cep, items));
});
