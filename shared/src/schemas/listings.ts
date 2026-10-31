import { z } from 'zod';
import {
  GRADES,
  MAX_LISTING_QUANTITY_KG,
  MAX_PRICE_PER_KG,
  MIN_LISTING_QUANTITY_KG,
  MIN_PRICE_PER_KG,
  OFFER_MESSAGE_MAX_LENGTH,
} from '../constants';
import { districtSchema } from './auth';
import { cropKeySchema } from './prices';
import { paginationSchema } from './common';

// ---------------------------------------------------------------------------
// Listings (Phase 3)
// ---------------------------------------------------------------------------

export const gradeSchema = z.enum(GRADES, {
  errorMap: () => ({ message: 'Select a grade' }),
});

const quantityKgSchema = z.coerce
  .number({ invalid_type_error: 'Enter a quantity' })
  .min(MIN_LISTING_QUANTITY_KG, `Quantity must be at least ${MIN_LISTING_QUANTITY_KG} kg`)
  .max(MAX_LISTING_QUANTITY_KG, `Quantity must be at most ${MAX_LISTING_QUANTITY_KG} kg`);

const pricePerKgSchema = z.coerce
  .number({ invalid_type_error: 'Enter a price' })
  .min(MIN_PRICE_PER_KG, `Price must be at least ₹${MIN_PRICE_PER_KG}`)
  .max(MAX_PRICE_PER_KG, `Price must be at most ₹${MAX_PRICE_PER_KG}`);

export const createListingSchema = z.object({
  cropKey: cropKeySchema,
  grade: gradeSchema,
  quantityKg: quantityKgSchema,
  pricePerKg: pricePerKgSchema,
  readyDate: z.coerce.date({ invalid_type_error: 'Enter a valid date' }),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

export const listingFiltersSchema = paginationSchema.extend({
  crop: cropKeySchema.optional(),
  district: districtSchema.optional(),
  grade: gradeSchema.optional(),
});

export type ListingFiltersInput = z.infer<typeof listingFiltersSchema>;

// ---------------------------------------------------------------------------
// Offers (Phase 3)
// ---------------------------------------------------------------------------

export const createOfferSchema = z.object({
  quantityKg: quantityKgSchema,
  offeredPricePerKg: pricePerKgSchema,
  message: z.string().trim().max(OFFER_MESSAGE_MAX_LENGTH).optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const declineOfferSchema = z.object({
  reason: z.string().trim().max(OFFER_MESSAGE_MAX_LENGTH).optional(),
});

export type DeclineOfferInput = z.infer<typeof declineOfferSchema>;

export const offersFiltersSchema = paginationSchema;
export type OffersFiltersInput = z.infer<typeof offersFiltersSchema>;
