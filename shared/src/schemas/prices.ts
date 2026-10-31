import { z } from 'zod';
import {
  CROP_KEYS,
  PRICE_TREND_DEFAULT_DAYS,
  PRICE_TREND_MAX_DAYS,
  TN_DISTRICTS,
} from '../constants';
import { districtSchema } from './auth';

// ---------------------------------------------------------------------------
// Mandi prices (Phase 2)
// ---------------------------------------------------------------------------

export const cropKeySchema = z.string().refine((key) => CROP_KEYS.includes(key), {
  message: 'Unknown crop',
});

/** District is optional here: an authenticated user falls back to their own. */
export const todayPricesQuerySchema = z.object({
  district: z.enum(TN_DISTRICTS).optional(),
});

export const priceTrendQuerySchema = z.object({
  district: districtSchema,
  crop: cropKeySchema,
  days: z.coerce.number().int().min(2).max(PRICE_TREND_MAX_DAYS).default(PRICE_TREND_DEFAULT_DAYS),
});

export const fairPriceCheckSchema = z.object({
  district: districtSchema,
  crop: cropKeySchema,
  price: z.coerce.number().positive('Enter a price greater than zero'),
});

export type TodayPricesQuery = z.infer<typeof todayPricesQuerySchema>;
export type PriceTrendQuery = z.infer<typeof priceTrendQuerySchema>;
export type FairPriceCheckInput = z.infer<typeof fairPriceCheckSchema>;
