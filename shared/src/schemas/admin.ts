import { z } from 'zod';
import { ROLES, VERIFICATION_STATUSES } from '../constants';
import { paginationSchema } from './common';

// ---------------------------------------------------------------------------
// Admin: user management (Phase 7)
// ---------------------------------------------------------------------------

export const adminUsersFiltersSchema = paginationSchema.extend({
  role: z.enum(ROLES).optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
  suspended: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type AdminUsersFilters = z.infer<typeof adminUsersFiltersSchema>;

export const verifyBuyerSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
});
export type VerifyBuyerInput = z.infer<typeof verifyBuyerSchema>;

export const suspendUserSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
