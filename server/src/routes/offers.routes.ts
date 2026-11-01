import { declineOfferSchema, idParamSchema, paginationSchema } from '@farmfair/shared';
import { Router } from 'express';
import {
  acceptOfferHandler,
  declineOfferHandler,
  getMyOffersHandler,
  withdrawOfferHandler,
} from '../controllers/offers.controller';
import { blockSuspended, requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const offersRouter = Router();

offersRouter.get(
  '/mine',
  requireAuth,
  requireRole('buyer'),
  validate({ query: paginationSchema }),
  getMyOffersHandler,
);

offersRouter.patch(
  '/:id/withdraw',
  requireAuth,
  requireRole('buyer'),
  blockSuspended,
  validate({ params: idParamSchema }),
  withdrawOfferHandler,
);

offersRouter.patch(
  '/:id/decline',
  requireAuth,
  requireRole('farmer'),
  blockSuspended,
  validate({ params: idParamSchema, body: declineOfferSchema }),
  declineOfferHandler,
);

offersRouter.patch(
  '/:id/accept',
  requireAuth,
  requireRole('farmer'),
  blockSuspended,
  validate({ params: idParamSchema }),
  acceptOfferHandler,
);
