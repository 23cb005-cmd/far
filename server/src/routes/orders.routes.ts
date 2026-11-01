import {
  cancelOrderSchema,
  createRatingSchema,
  idParamSchema,
  paginationSchema,
} from '@farmfair/shared';
import { Router } from 'express';
import {
  cancelOrderHandler,
  confirmPickupHandler,
  getMyOrdersHandler,
  payOrderHandler,
  submitRatingHandler,
} from '../controllers/orders.controller';
import { blockSuspended, requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const ordersRouter = Router();

ordersRouter.get('/mine', requireAuth, validate({ query: paginationSchema }), getMyOrdersHandler);

// Only the buyer ever pays; farmer/buyer membership is re-checked in the
// service either way, but the role gate rejects the wrong role earlier.
ordersRouter.patch(
  '/:id/pay',
  requireAuth,
  requireRole('buyer'),
  blockSuspended,
  validate({ params: idParamSchema }),
  payOrderHandler,
);

ordersRouter.patch(
  '/:id/confirm',
  requireAuth,
  blockSuspended,
  validate({ params: idParamSchema }),
  confirmPickupHandler,
);

ordersRouter.patch(
  '/:id/cancel',
  requireAuth,
  blockSuspended,
  validate({ params: idParamSchema, body: cancelOrderSchema }),
  cancelOrderHandler,
);

ordersRouter.post(
  '/:id/rating',
  requireAuth,
  blockSuspended,
  validate({ params: idParamSchema, body: createRatingSchema }),
  submitRatingHandler,
);
