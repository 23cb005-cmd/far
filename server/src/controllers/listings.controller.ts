import {
  createListingSchema,
  listingFiltersSchema,
  paginationSchema,
  type ListingDto,
  type Paginated,
} from '@farmfair/shared';
import { currentUser } from '../middleware/auth';
import { listingPhotoUrl } from '../middleware/upload';
import {
  browseListings,
  createListing,
  getListingDetail,
  getMyListings,
  withdrawListing,
} from '../services/listings';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/respond';

/** POST /listings */
export const createListingHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = createListingSchema.parse(req.body);
  const photoUrl = req.file ? listingPhotoUrl(req.file.filename) : undefined;

  const listing: ListingDto = await createListing(user, input, photoUrl);
  sendCreated(res, listing);
});

/** GET /listings */
export const browseListingsHandler = asyncHandler(async (req, res) => {
  const filters = listingFiltersSchema.parse(req.query);
  const body: Paginated<ListingDto> = await browseListings(filters);
  sendSuccess(res, body);
});

/** GET /listings/mine */
export const getMyListingsHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const { page, limit } = paginationSchema.parse(req.query);
  const body: Paginated<ListingDto> = await getMyListings(user, page, limit);
  sendSuccess(res, body);
});

/** GET /listings/:id */
export const getListingHandler = asyncHandler(async (req, res) => {
  const listing: ListingDto = await getListingDetail(req.params.id!);
  sendSuccess(res, listing);
});

/** PATCH /listings/:id/withdraw */
export const withdrawListingHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const listing: ListingDto = await withdrawListing(user, req.params.id!);
  sendSuccess(res, listing);
});
