import {
  type CreateListingInput,
  type ListingDto,
  type ListingFiltersInput,
  type Paginated,
} from '@farmfair/shared';
import type { Types } from 'mongoose';
import { env } from '../config/env';
import { Listing, type ListingDocument } from '../models/Listing';
import { Offer } from '../models/Offer';
import type { UserDocument } from '../models/User';
import { AppError } from '../utils/AppError';
import { paginated } from '../utils/respond';

/**
 * `Omit<..., 'farmer'>` rather than `ListingDocument`: callers often pass a
 * document whose `farmer` field mongoose has populated into a `UserDocument`
 * instead of an id, which this function ignores anyway - it takes `farmer`
 * as its own parameter so the caller decides what populated data it has.
 */
function toListingDto(
  listing: Omit<ListingDocument, 'farmer'>,
  farmer: UserDocument,
  offerCount?: number,
): ListingDto {
  return {
    id: String(listing._id),
    farmer: farmer.toPublicJSON(),
    cropKey: listing.cropKey,
    grade: listing.grade,
    quantityKg: listing.quantityKg,
    pricePerKg: listing.pricePerKg,
    readyDate: listing.readyDate.toISOString(),
    district: listing.district,
    ...(listing.photoUrl ? { photoUrl: listing.photoUrl } : {}),
    status: listing.effectiveStatus(),
    expiresAt: listing.expiresAt.toISOString(),
    ...(offerCount !== undefined ? { offerCount } : {}),
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

/** Loads a listing with its farmer populated, or throws 404. */
export async function getListingOrThrow(id: string) {
  const listing = await Listing.findById(id).populate<{ farmer: UserDocument }>('farmer').exec();
  if (!listing) throw AppError.notFound('Listing not found');
  return listing;
}

export type PopulatedListing = Awaited<ReturnType<typeof getListingOrThrow>>;

export async function createListing(
  farmer: UserDocument,
  input: CreateListingInput,
  photoUrl?: string,
): Promise<ListingDto> {
  const expiresAt = new Date(Date.now() + env.LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const listing = await Listing.create({
    farmer: farmer._id,
    cropKey: input.cropKey,
    grade: input.grade,
    quantityKg: input.quantityKg,
    pricePerKg: input.pricePerKg,
    readyDate: input.readyDate,
    district: farmer.district,
    ...(photoUrl ? { photoUrl } : {}),
    expiresAt,
  });

  return toListingDto(listing, farmer);
}

/** Active, unexpired listings across the marketplace, filtered and paginated. */
export async function browseListings(filters: ListingFiltersInput): Promise<Paginated<ListingDto>> {
  const query: Record<string, unknown> = {
    status: 'active',
    expiresAt: { $gt: new Date() },
  };
  if (filters.crop) query.cropKey = filters.crop;
  if (filters.district) query.district = filters.district;
  if (filters.grade) query.grade = filters.grade;

  const [total, listings] = await Promise.all([
    Listing.countDocuments(query),
    Listing.find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .populate<{ farmer: UserDocument }>('farmer')
      .exec(),
  ]);

  const items = listings.map((listing) => toListingDto(listing, listing.farmer));
  return paginated(items, filters.page, filters.limit, total);
}

export async function getListingDetail(id: string): Promise<ListingDto> {
  const listing = await getListingOrThrow(id);
  return toListingDto(listing, listing.farmer);
}

/** A farmer's own listings, each with its count of pending offers. */
export async function getMyListings(
  farmer: UserDocument,
  page: number,
  limit: number,
): Promise<Paginated<ListingDto>> {
  const query = { farmer: farmer._id };

  const [total, listings] = await Promise.all([
    Listing.countDocuments(query),
    Listing.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
  ]);

  const counts = await Offer.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { listing: { $in: listings.map((l) => l._id) }, status: 'pending' } },
    { $group: { _id: '$listing', count: { $sum: 1 } } },
  ]);
  const countByListing = new Map(counts.map((c) => [String(c._id), c.count]));

  const items = listings.map((listing) =>
    toListingDto(listing, farmer, countByListing.get(String(listing._id)) ?? 0),
  );
  return paginated(items, page, limit, total);
}

export async function withdrawListing(farmer: UserDocument, id: string): Promise<ListingDto> {
  const listing = await getListingOrThrow(id);

  if (String(listing.farmer._id) !== String(farmer._id)) {
    throw AppError.forbidden('You do not own this listing');
  }
  if (listing.effectiveStatus() !== 'active') {
    throw AppError.conflict('This listing is no longer active');
  }

  listing.status = 'withdrawn';
  await listing.save();

  return toListingDto(listing, listing.farmer);
}
