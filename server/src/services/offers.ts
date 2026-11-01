import {
  type CreateOfferInput,
  type DeclineOfferInput,
  type District,
  type OfferDto,
  type Paginated,
} from '@farmfair/shared';
import { getListingOrThrow } from './listings';
import { Offer, type OfferDocument } from '../models/Offer';
import { Listing, type ListingDocument } from '../models/Listing';
import type { UserDocument } from '../models/User';
import { AppError } from '../utils/AppError';
import { paginated } from '../utils/respond';
import { getTodayModalPrice, round2 } from './mandiPrices';
import { notify } from './notifications';
import { generateUniqueCode } from '../utils/shortCode';

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
    code: offer.code,
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
    code: await generateUniqueCode(Offer),
  });

  await notify(
    listing.farmer._id,
    'offer_created',
    {
      cropKey: listing.cropKey,
      quantityKg: offer.quantityKg,
      offeredPricePerKg: offer.offeredPricePerKg,
      buyerName: buyer.name,
    },
    { listingId: String(listing._id), offerId: String(offer._id) },
  );

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

export async function getOwnedOfferOrThrow(offerId: string) {
  const offer = await Offer.findById(offerId)
    .populate<{ listing: ListingDocument; buyer: UserDocument }>(['listing', 'buyer'])
    .exec();
  if (!offer) throw AppError.notFound('Offer not found');
  return offer;
}

/** Resolve a short bot-reference code (Phase 6) back to the offer it was issued for. */
export async function findOfferByCode(code: string) {
  return Offer.findOne({ code: code.toUpperCase() })
    .populate<{ listing: ListingDocument; buyer: UserDocument }>(['listing', 'buyer'])
    .exec();
}

/** A farmer's most recent pending offers, across every one of their listings - for the WhatsApp bot's OFFERS command. */
export async function getPendingOffersForFarmer(
  farmer: UserDocument,
  limit: number,
): Promise<OfferDto[]> {
  const listings = await Listing.find({ farmer: farmer._id }).select('_id').exec();

  const offers = await Offer.find({
    listing: { $in: listings.map((l) => l._id) },
    status: 'pending',
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate<{ listing: ListingDocument; buyer: UserDocument }>(['listing', 'buyer'])
    .exec();

  return offers.map((offer) => toOfferDto(offer, offer.listing, offer.buyer));
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

  await notify(
    offer.buyer._id,
    'offer_declined',
    { cropKey: offer.listing.cropKey },
    { listingId: String(offer.listing._id), offerId: String(offer._id) },
  );

  return toOfferDto(offer, offer.listing, offer.buyer);
}
