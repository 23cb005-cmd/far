import { JobRun } from '../models/JobRun';
import { Notification } from '../models/Notification';
import type { JobResult } from './runner';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Trim data nobody needs to keep forever.
 *
 * Expired OTPs are not handled here: `OtpCode` already has a Mongo TTL index
 * on `expiresAt` (see that model), so the database removes them on its own.
 */
export async function cleanup(): Promise<JobResult> {
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS);

  const [oldNotifications, oldJobRuns] = await Promise.all([
    Notification.deleteMany({ read: true, readAt: { $lt: cutoff } }),
    JobRun.deleteMany({ startedAt: { $lt: cutoff } }),
  ]);

  return {
    summary: `Removed ${oldNotifications.deletedCount ?? 0} old notification(s), ${
      oldJobRuns.deletedCount ?? 0
    } old job run(s)`,
  };
}
