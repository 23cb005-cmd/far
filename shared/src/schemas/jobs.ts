import { z } from 'zod';
import { JOB_NAMES } from '../constants';

// ---------------------------------------------------------------------------
// Scheduled jobs: admin manual trigger (Phase 5)
// ---------------------------------------------------------------------------

export const jobNameParamSchema = z.object({
  name: z.enum(JOB_NAMES),
});

export type JobNameParam = z.infer<typeof jobNameParamSchema>;
