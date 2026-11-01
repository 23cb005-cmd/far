import { z } from 'zod';
import { paginationSchema } from './common';

// ---------------------------------------------------------------------------
// Notifications (Phase 5)
// ---------------------------------------------------------------------------

export const notificationsFiltersSchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().optional().default(false),
});

export type NotificationsFiltersInput = z.infer<typeof notificationsFiltersSchema>;
