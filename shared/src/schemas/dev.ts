import { z } from 'zod';

// ---------------------------------------------------------------------------
// Development-only WhatsApp bot simulator (Phase 6)
// ---------------------------------------------------------------------------

export const devBotSimulateSchema = z.object({
  from: z.string().min(1, 'Enter a phone number'),
  body: z.string().min(1, 'Enter a message').max(1000),
});

export type DevBotSimulateInput = z.infer<typeof devBotSimulateSchema>;
