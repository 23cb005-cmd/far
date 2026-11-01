import {
  type CancelOrderInput,
  type CreateRatingInput,
  type OrderDto,
  type Paginated,
  type RatingDto,
} from '@farmfair/shared';
import type { Types } from 'mongoose';
import { env } from '../config/env';
import { type ListingDocument } from '../models/Listing';
import { Offer } from '../models/Offer';
import { Order, type OrderDocument } from '../models/Order';
import { Rating } from '../models/Rating';
import { User, type UserDocument } from '../models/User';
import { getPaymentProvider } from '../providers/payment';
import { AppError } from '../utils/AppError';
import { paginated } from '../utils/respond';
import { getOwnedOfferOrThrow } from './offers';
import { round2 } from './mandiPrices';

/** See the comment on `toListingDto` in `listings.ts` for why these take `Omit`. */
function toOrderDto(
  order: Omit<OrderDocument, 'listing' | 'farmer' | 'buyer'>,
  listing: Omit<ListingDocument, 'farmer'>,
  farmer: UserDocument,
  buyer: UserDocument,
  myRatingSubmitted: boolean,
): OrderDto {
  return {
    id: String(order._id),
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
    farmer: farmer.toPublicJSON(),
    buyer: buyer.toPublicJSON(),
    cropKey: order.cropKey,
    quantityKg: order.quantityKg,
    pricePerKg: order.pricePerKg,
    totalAmount: order.totalAmount,
    commissionPercent: order.commissionPercent,
    commissionAmount: order.commissionAmount,
    payoutAmount: order.payoutAmount,
    status: order.status,
    ...(order.paymentProvider ? { paymentProvider: order.paymentProvider } : {}),
    ...(order.paidAt ? { paidAt: order.paidAt.toISOString() } : {}),
    ...(order.farmerConfirmedAt
      ? { farmerConfirmedAt: order.farmerConfirmedAt.toISOString() }
      : {}),
    ...(order.buyerConfirmedAt ? { buyerConfirmedAt: order.buyerConfirmedAt.toISOString() } : {}),
    ...(order.completedAt ? { completedAt: order.completedAt.toISOString() } : {}),
    ...(order.cancelledAt ? { cancelledAt: order.cancelledAt.toISOString() } : {}),
    ...(order.cancelReason ? { cancelReason: order.cancelReason } : {}),
    myRatingSubmitted,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

async function getOwnedOrderOrThrow(userId: Types.ObjectId, orderId: string) {
  const order = await Order.findById(orderId)
    .populate<{ listing: ListingDocument; farmer: UserDocument; buyer: UserDocument }>([
      'listing',
      'farmer',
      'buyer',
    ])
    .exec();
  if (!order) throw AppError.notFound('Order not found');

  const isParty =
    String(order.farmer._id) === String(userId) || String(order.buyer._id) === String(userId);
  if (!isParty) throw AppError.forbidden('You are not a party to this order');

  return order;
}

async function hasRated(orderId: Types.ObjectId, raterId: Types.ObjectId): Promise<boolean> {
  return Boolean(await Rating.exists({ order: orderId, rater: raterId }));
}

/**
 * Accept a pending offer: forms the deal, snapshots its terms into a new
 * Order, marks the listing sold, and declines every other pending offer on
 * it - a listing is one batch sold once, not a pool split across buyers.
 */
export async function acceptOffer(farmer: UserDocument, offerId: string): Promise<OrderDto> {
  const offer = await getOwnedOfferOrThrow(offerId);

  if (String(offer.listing.farmer) !== String(farmer._id)) {
    throw AppError.forbidden('You do not own the listing this offer was made on');
  }
  if (offer.status !== 'pending') {
    throw AppError.conflict('This offer is no longer pending');
  }
  if (offer.listing.effectiveStatus() !== 'active') {
    throw AppError.conflict('This listing is no longer active');
  }

  const totalAmount = round2(offer.quantityKg * offer.offeredPricePerKg);
  const commissionAmount = round2(totalAmount * (env.COMMISSION_PERCENT / 100));
  const payoutAmount = round2(totalAmount - commissionAmount);

  const order = await Order.create({
    listing: offer.listing._id,
    offer: offer._id,
    farmer: farmer._id,
    buyer: offer.buyer._id,
    cropKey: offer.listing.cropKey,
    quantityKg: offer.quantityKg,
    pricePerKg: offer.offeredPricePerKg,
    totalAmount,
    commissionPercent: env.COMMISSION_PERCENT,
    commissionAmount,
    payoutAmount,
  });

  offer.status = 'accepted';
  await offer.save();

  offer.listing.status = 'sold';
  await offer.listing.save();

  await Offer.updateMany(
    { listing: offer.listing._id, status: 'pending', _id: { $ne: offer._id } },
    { status: 'declined', declineReason: 'The listing was sold to another buyer.' },
  );

  return toOrderDto(order, offer.listing, farmer, offer.buyer, false);
}

/** The buyer pays the order's total into escrow. */
export async function payOrder(buyer: UserDocument, orderId: string): Promise<OrderDto> {
  const order = await getOwnedOrderOrThrow(buyer._id, orderId);

  if (String(order.buyer._id) !== String(buyer._id)) {
    throw AppError.forbidden('Only the buyer can pay for this order');
  }
  if (order.status !== 'pending_payment') {
    throw AppError.conflict('This order is not awaiting payment');
  }

  const provider = getPaymentProvider();
  const result = await provider.chargeEscrow({
    orderId: String(order._id),
    amount: order.totalAmount,
    description: `FarmFair order ${String(order._id)}`,
  });
  if (!result.success) {
    throw AppError.badRequest('Payment could not be completed. Please try again.');
  }

  order.status = 'paid';
  order.paymentProvider = provider.name;
  order.paymentReference = result.reference;
  order.paidAt = new Date();
  await order.save();

  const rated = await hasRated(order._id, buyer._id);
  return toOrderDto(order, order.listing, order.farmer, order.buyer, rated);
}

/**
 * Confirm pickup from one side. Funds are considered released - no real
 * transfer happens, since a `User` has no bank/UPI payout details yet - once
 * both the farmer and the buyer have confirmed.
 */
export async function confirmPickup(user: UserDocument, orderId: string): Promise<OrderDto> {
  const order = await getOwnedOrderOrThrow(user._id, orderId);

  if (order.status !== 'paid') {
    throw AppError.conflict('This order is not ready for pickup confirmation');
  }

  const isFarmer = String(order.farmer._id) === String(user._id);
  if (isFarmer) {
    if (order.farmerConfirmedAt) {
      throw AppError.conflict('You have already confirmed this pickup');
    }
    order.farmerConfirmedAt = new Date();
  } else {
    if (order.buyerConfirmedAt) {
      throw AppError.conflict('You have already confirmed this pickup');
    }
    order.buyerConfirmedAt = new Date();
  }

  if (order.isFullyConfirmed()) {
    order.status = 'completed';
    order.completedAt = new Date();
  }
  await order.save();

  const rated = await hasRated(order._id, user._id);
  return toOrderDto(order, order.listing, order.farmer, order.buyer, rated);
}

/** Cancel an order before payment. Once escrowed, the only forward path is pickup confirmation. */
export async function cancelOrder(
  user: UserDocument,
  orderId: string,
  input: CancelOrderInput,
): Promise<OrderDto> {
  const order = await getOwnedOrderOrThrow(user._id, orderId);

  if (order.status !== 'pending_payment') {
    throw AppError.conflict('Only an order awaiting payment can be cancelled');
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  if (input.reason) order.cancelReason = input.reason;
  await order.save();

  order.listing.status = 'active';
  await order.listing.save();

  return toOrderDto(order, order.listing, order.farmer, order.buyer, false);
}

/** Every order where the signed-in user is either the farmer or the buyer. */
export async function getMyOrders(
  user: UserDocument,
  page: number,
  limit: number,
): Promise<Paginated<OrderDto>> {
  const query = { $or: [{ farmer: user._id }, { buyer: user._id }] };

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ listing: ListingDocument; farmer: UserDocument; buyer: UserDocument }>([
        'listing',
        'farmer',
        'buyer',
      ])
      .exec(),
  ]);

  const ratedDocs = await Rating.find({
    rater: user._id,
    order: { $in: orders.map((o) => o._id) },
  })
    .select('order')
    .exec();
  const ratedOrderIds = new Set(ratedDocs.map((r) => String(r.order)));

  const items = orders.map((order) =>
    toOrderDto(
      order,
      order.listing,
      order.farmer,
      order.buyer,
      ratedOrderIds.has(String(order._id)),
    ),
  );
  return paginated(items, page, limit, total);
}

/** Recompute a user's rating aggregate from every rating they have received. */
async function recomputeRatingAggregate(userId: Types.ObjectId): Promise<void> {
  const [agg] = await Rating.aggregate<{ _id: null; avg: number; count: number }>([
    { $match: { ratee: userId } },
    { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
  ]);
  await User.updateOne(
    { _id: userId },
    { ratingAvg: agg ? round2(agg.avg) : 0, ratingCount: agg?.count ?? 0 },
  );
}

/** Rate the other party on a completed order. One rating per rater per order. */
export async function submitRating(
  user: UserDocument,
  orderId: string,
  input: CreateRatingInput,
): Promise<RatingDto> {
  const order = await getOwnedOrderOrThrow(user._id, orderId);

  if (order.status !== 'completed') {
    throw AppError.conflict('You can only rate a completed order');
  }
  if (await hasRated(order._id, user._id)) {
    throw AppError.conflict('You have already rated this order');
  }

  const isFarmer = String(order.farmer._id) === String(user._id);
  const rateeId = isFarmer ? order.buyer._id : order.farmer._id;

  const rating = await Rating.create({
    order: order._id,
    rater: user._id,
    ratee: rateeId,
    score: input.score,
    ...(input.comment ? { comment: input.comment } : {}),
  });

  await recomputeRatingAggregate(rateeId);

  return {
    id: String(rating._id),
    order: String(rating.order),
    rater: String(rating.rater),
    ratee: String(rating.ratee),
    score: rating.score,
    ...(rating.comment ? { comment: rating.comment } : {}),
    createdAt: rating.createdAt.toISOString(),
  };
}
