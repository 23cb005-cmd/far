import {
  type CreateOfferInput,
  type DeclineOfferInput,
  type District,
  type OfferDto,
  type Paginated,
} from '@farmfair/shared';
import { getListingOrThrow } from './listings';
import { Offer, type OfferDocument } from '../models/Offer';
import type { ListingDocument } from '../models/Listing';
import type { UserDocument } from '../models/User';
import { AppError } from '../utils/AppError';
import { paginated } from '../utils/respond';
import { getTodayModalPrice, round2 } from './mandiPrices';

/** See the comment on `toListingDto` in `listings.ts` for why these take `Omit`. */
function toOfferDto(
  offer: Omit<OfferDocument, 'listing' | 'buyer'>,
  listing: Omit<ListingDocument, 'farmer'>,
  buyer: UserDocument,
): OfferDto {
  const diffPercent =
    offer.marketPriceAtOffer !== undefined
      ? round2(
          ((offer.offeredPricePerKg - offer.marketPriceAtOffer) / offer.marketPriceAtOffer) * 100,
        )
      : undefined;

  return {
    id: String(offer._id),
    listing: {
      id: String(listing._id),
      cropKey: listing.cropKey,
      grade: listing.grade,
      pricePerKg: listing.pricePerKg,
      quantityKg: listing.quantityKg,
      district: listing.district,
      ...(listing.photoUrl ? { photoUrl: listing.photoUrl } : {}),
      status: listing.effectiveStatus(),
    },
    buyer: buyer.toPublicJSON(),
    quantityKg: offer.quantityKg,
    offeredPricePerKg: offer.offeredPricePerKg,
    ...(offer.message ? { message: offer.message } : {}),
    ...(offer.marketPriceAtOffer !== undefined
      ? { marketPriceAtOffer: offer.marketPriceAtOffer }
      : {}),
    ...(diffPercent !== undefined ? { diffPercent } : {}),
    status: offer.status,
    ...(offer.declineReason ? { declineReason: offer.declineReason } : {}),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  };
}

export async function createOffer(
  buyer: UserDocument,
  listingId: string,
  input: CreateOfferInput,
): Promise<OfferDto> {
  const listing = await getListingOrThrow(listingId);

  if (listing.effectiveStatus() !== 'active') {
    throw AppError.badRequest('This listing is no longer available');
  }
  if (input.quantityKg > listing.quantityKg) {
    throw AppError.badRequest('Offer quantity cannot exceed the listing quantity');
  }

  // A snapshot, not a live lookup: today's offer should stay labelled against
  // today's rate even if the mandi price has moved by the time it is read.
  const today = await getTodayModalPrice(listing.district as District, listing.cropKey);

  const offer = await Offer.create({
    listing: listing._id,
    buyer: buyer._id,
    quantityKg: input.quantityKg,
    offeredPricePerKg: input.offeredPricePerKg,
    ...(input.message ? { message: input.message } : {}),
    ...(today ? { marketPriceAtOffer: today.modalPrice } : {}),
  });

  return toOfferDto(offer, listing, buyer);
}

/** A farmer's view of the offers on one of their own listings. */
export async function getOffersForListing(
  farmer: UserDocument,
  listingId: string,
  page: number,
  limit: number,
): Promise<Paginated<OfferDto>> {
  const listing = await getListingOrThrow(listingId);
  if (String(listing.farmer._id) !== String(farmer._id)) {
    throw AppError.forbidden('You do not own this listing');
  }

  const query = { listing: listing._id };
  const [total, offers] = await Promise.all([
    Offer.countDocuments(query),
    Offer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ buyer: UserDocument }>('buyer')
      .exec(),
  ]);

  const items = offers.map((offer) => toOfferDto(offer, listing, offer.buyer));
  return paginated(items, page, limit, total);
}

/** A buyer's own offers, across every listing. */
export async function getMyOffers(
  buyer: UserDocument,
  page: number,
  limit: number,
): Promise<Paginated<OfferDto>> {
  const query = { buyer: buyer._id };
  const [total, offers] = await Promise.all([
    Offer.countDocuments(query),
    Offer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ listing: ListingDocument }>('listing')
      .exec(),
  ]);

  const items = offers.map((offer) => toOfferDto(offer, offer.listing, buyer));
  return paginated(items, page, limit, total);
}

async function getOwnedOfferOrThrow(offerId: string) {
  const offer = await Offer.findById(offerId)
    .populate<{ listing: ListingDocument; buyer: UserDocument }>(['listing', 'buyer'])
    .exec();
  if (!offer) throw AppError.notFound('Offer not found');
  return offer;
}

export async function withdrawOffer(buyer: UserDocument, offerId: string): Promise<OfferDto> {
  const offer = await getOwnedOfferOrThrow(offerId);

  if (String(offer.buyer._id) !== String(buyer._id)) {
    throw AppError.forbidden('You do not own this offer');
  }
  if (offer.status !== 'pending') {
    throw AppError.conflict('This offer is no longer pending');
  }

  offer.status = 'withdrawn';
  await offer.save();

  return toOfferDto(offer, offer.listing, offer.buyer);
}

export async function declineOffer(
  farmer: UserDocument,
  offerId: string,
  input: DeclineOfferInput,
): Promise<OfferDto> {
  const offer = await getOwnedOfferOrThrow(offerId);

  if (String(offer.listing.farmer) !== String(farmer._id)) {
    throw AppError.forbidden('You do not own the listing this offer was made on');
  }
  if (offer.status !== 'pending') {
    throw AppError.conflict('This offer is no longer pending');
  }

  offer.status = 'declined';
  if (input.reason) offer.declineReason = input.reason;
  await offer.save();

  return toOfferDto(offer, offer.listing, offer.buyer);
}
