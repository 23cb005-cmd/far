import { Listing } from '../models/Listing';
import { Offer } from '../models/Offer';
import { notify } from '../services/notifications';
import type { JobResult } from './runner';

/**
 * Flip listings whose `expiresAt` has passed from `active` to `expired`.
 *
 * `effectiveStatus()` already reads an overdue listing as expired on the
 * fly, so browsing and the farmer's own list are correct without this job.
 * What only this job does is decline the listing's still-pending offers (a
 * buyer should not be left waiting on a dead listing) and tell the farmer.
 */
export async function expireListings(): Promise<JobResult> {
  const listings = await Listing.find({
    status: 'active',
    expiresAt: { $lte: new Date() },
  }).exec();

  for (const listing of listings) {
    listing.status = 'expired';
    await listing.save();

    await Offer.updateMany(
      { listing: listing._id, status: 'pending' },
      { status: 'declined', declineReason: 'The listing expired before the farmer responded.' },
    );

    await notify(
      listing.farmer,
      'listing_expired',
      { cropKey: listing.cropKey },
      { listingId: String(listing._id) },
    );
  }

  return { summary: `Expired ${listings.length} listing(s)` };
}
