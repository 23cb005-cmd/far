import { z } from 'zod';
import {
  CANCEL_REASON_MAX_LENGTH,
  RATING_COMMENT_MAX_LENGTH,
  RATING_MAX,
  RATING_MIN,
} from '../constants';
import { paginationSchema } from './common';

// ---------------------------------------------------------------------------
// Orders (Phase 4)
// ---------------------------------------------------------------------------

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(CANCEL_REASON_MAX_LENGTH).optional(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const ordersFiltersSchema = paginationSchema;
export type OrdersFiltersInput = z.infer<typeof ordersFiltersSchema>;

// ---------------------------------------------------------------------------
// Ratings (Phase 4)
// ---------------------------------------------------------------------------

export const createRatingSchema = z.object({
  score: z.coerce
    .number({ invalid_type_error: 'Rate from 1 to 5' })
    .int('Rate from 1 to 5')
    .min(RATING_MIN, 'Rate from 1 to 5')
    .max(RATING_MAX, 'Rate from 1 to 5'),
  comment: z.string().trim().max(RATING_COMMENT_MAX_LENGTH).optional(),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
