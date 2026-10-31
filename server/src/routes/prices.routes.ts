import {
  fairPriceCheckSchema,
  priceTrendQuerySchema,
  todayPricesQuerySchema,
} from '@farmfair/shared';
import { Router } from 'express';
import {
  checkFairPriceHandler,
  getPriceTrendHandler,
  getTodayPricesHandler,
} from '../controllers/prices.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const pricesRouter = Router();

pricesRouter.get(
  '/today',
  requireAuth,
  validate({ query: todayPricesQuerySchema }),
  getTodayPricesHandler,
);
pricesRouter.get(
  '/trend',
  requireAuth,
  validate({ query: priceTrendQuerySchema }),
  getPriceTrendHandler,
);
pricesRouter.post(
  '/fair-check',
  requireAuth,
  validate({ body: fairPriceCheckSchema }),
  checkFairPriceHandler,
);
