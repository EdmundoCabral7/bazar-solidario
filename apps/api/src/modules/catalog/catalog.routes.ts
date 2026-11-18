import { Router } from 'express';
import {
  animalFiltersSchema,
  animalInputSchema,
  campaignInputSchema,
  productFiltersSchema,
  productInputSchema,
} from '@bazar/shared';
import { requireAuth, requireRole } from '../../middlewares/auth';
import * as service from './catalog.service';

export const catalogRoutes = Router();

catalogRoutes.get('/animals', async (req, res) => {
  res.json(await service.listAnimals(animalFiltersSchema.parse(req.query)));
});
catalogRoutes.get('/animals/:slug', async (req, res) => {
  res.json(await service.getAnimalBySlug(req.params.slug));
});
catalogRoutes.get('/products', async (req, res) => {
  res.json(await service.listProducts(productFiltersSchema.parse(req.query)));
});
catalogRoutes.get('/products/categories', async (_req, res) => {
  res.json(await service.listCategories());
});
catalogRoutes.get('/products/:slug', async (req, res) => {
  res.json(await service.getProductBySlug(req.params.slug));
});
catalogRoutes.get('/campaigns', async (_req, res) => {
  res.json(await service.listCampaigns({ activeOnly: true }));
});
catalogRoutes.get('/campaigns/:slug', async (req, res) => {
  res.json(await service.getCampaign(req.params.slug));
});

/** CRUD administrativo (voluntários e admins). */
export const adminCatalogRoutes = Router();
adminCatalogRoutes.use(requireAuth, requireRole('ADMIN', 'VOLUNTEER'));

adminCatalogRoutes.get('/animals', async (req, res) => {
  res.json(await service.listAnimals(animalFiltersSchema.parse(req.query), { admin: true }));
});
adminCatalogRoutes.post('/animals', async (req, res) => {
  res.status(201).json(await service.createAnimal(animalInputSchema.parse(req.body)));
});
adminCatalogRoutes.patch('/animals/:id', async (req, res) => {
  res.json(await service.updateAnimal(req.params.id, animalInputSchema.partial().parse(req.body)));
});
adminCatalogRoutes.delete('/animals/:id', async (req, res) => {
  await service.deleteAnimal(req.params.id);
  res.status(204).end();
});

adminCatalogRoutes.get('/products', async (req, res) => {
  res.json(await service.listProducts(productFiltersSchema.parse(req.query), { admin: true }));
});
adminCatalogRoutes.post('/products', async (req, res) => {
  res.status(201).json(await service.createProduct(productInputSchema.parse(req.body)));
});
adminCatalogRoutes.patch('/products/:id', async (req, res) => {
  res.json(
    await service.updateProduct(req.params.id, productInputSchema.partial().parse(req.body)),
  );
});
adminCatalogRoutes.delete('/products/:id', async (req, res) => {
  res.json(await service.deleteProduct(req.params.id));
});

adminCatalogRoutes.get('/campaigns', async (_req, res) => {
  res.json(await service.listCampaigns({ activeOnly: false }));
});
adminCatalogRoutes.post('/campaigns', async (req, res) => {
  res.status(201).json(await service.createCampaign(campaignInputSchema.parse(req.body)));
});
adminCatalogRoutes.patch('/campaigns/:id', async (req, res) => {
  res.json(
    await service.updateCampaign(req.params.id, campaignInputSchema.partial().parse(req.body)),
  );
});
