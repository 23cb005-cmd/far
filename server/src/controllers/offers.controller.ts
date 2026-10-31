import {
  createOfferSchema,
  declineOfferSchema,
  paginationSchema,
  type OfferDto,
  type Paginated,
} from '@farmfair/shared';
import { currentUser } from '../middleware/auth';
import {
  createOffer,
  declineOffer,
  getMyOffers,
  getOffersForListing,
  withdrawOffer,
} from '../services/offers';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/respond';

/** POST /listings/:id/offers */
export const createOfferHandler = asyncHandler(async (req, res) => {
  const buyer = currentUser(req);
  const input = createOfferSchema.parse(req.body);
  const offer: OfferDto = await createOffer(buyer, req.params.id!, input);
  sendCreated(res, offer);
});

/** GET /listings/:id/offers */
export const getOffersForListingHandler = asyncHandler(async (req, res) => {
  const farmer = currentUser(req);
  const { page, limit } = paginationSchema.parse(req.query);
  const body: Paginated<OfferDto> = await getOffersForListing(farmer, req.params.id!, page, limit);
  sendSuccess(res, body);
});

/** GET /offers/mine */
export const getMyOffersHandler = asyncHandler(async (req, res) => {
  const buyer = currentUser(req);
  const { page, limit } = paginationSchema.parse(req.query);
  const body: Paginated<OfferDto> = await getMyOffers(buyer, page, limit);
  sendSuccess(res, body);
});

/** PATCH /offers/:id/withdraw */
export const withdrawOfferHandler = asyncHandler(async (req, res) => {
  const buyer = currentUser(req);
  const offer: OfferDto = await withdrawOffer(buyer, req.params.id!);
  sendSuccess(res, offer);
});

/** PATCH /offers/:id/decline */
export const declineOfferHandler = asyncHandler(async (req, res) => {
  const farmer = currentUser(req);
  const input = declineOfferSchema.parse(req.body);
  const offer: OfferDto = await declineOffer(farmer, req.params.id!, input);
  sendSuccess(res, offer);
});
