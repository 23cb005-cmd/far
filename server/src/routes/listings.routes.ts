import {
  createListingSchema,
  createOfferSchema,
  idParamSchema,
  listingFiltersSchema,
  paginationSchema,
} from '@farmfair/shared';
import { Router } from 'express';
import {
  browseListingsHandler,
  createListingHandler,
  getListingHandler,
  getMyListingsHandler,
  withdrawListingHandler,
} from '../controllers/listings.controller';
import { createOfferHandler, getOffersForListingHandler } from '../controllers/offers.controller';
import { blockSuspended, requireAuth, requireRole, requireVerifiedBuyer } from '../middleware/auth';
import { listingPhotoUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';

export const listingsRouter = Router();

listingsRouter.post(
  '/',
  requireAuth,
  requireRole('farmer'),
  blockSuspended,
  listingPhotoUpload,
  validate({ body: createListingSchema }),
  createListingHandler,
);

listingsRouter.get(
  '/',
  requireAuth,
  validate({ query: listingFiltersSchema }),
  browseListingsHandler,
);

// Must come before `/:id`, or "mine" is parsed as an id and fails validation.
listingsRouter.get(
  '/mine',
  requireAuth,
  requireRole('farmer'),
  validate({ query: paginationSchema }),
  getMyListingsHandler,
);

listingsRouter.get('/:id', requireAuth, validate({ params: idParamSchema }), getListingHandler);

listingsRouter.patch(
  '/:id/withdraw',
  requireAuth,
  requireRole('farmer'),
  blockSuspended,
  validate({ params: idParamSchema }),
  withdrawListingHandler,
);

listingsRouter.post(
  '/:id/offers',
  requireAuth,
  requireVerifiedBuyer,
  blockSuspended,
  validate({ params: idParamSchema, body: createOfferSchema }),
  createOfferHandler,
);

listingsRouter.get(
  '/:id/offers',
  requireAuth,
  requireRole('farmer'),
  validate({ params: idParamSchema, query: paginationSchema }),
  getOffersForListingHandler,
);
