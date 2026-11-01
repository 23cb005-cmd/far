import { JOB_NAMES, type JobName } from '@farmfair/shared';
import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../config/logger';
import { cleanup } from './cleanup';
import { expireListings } from './expireListings';
import { priceAlerts } from './priceAlerts';
import { runJob, type JobResult } from './runner';

const jobFn: Record<JobName, () => Promise<JobResult>> = {
  expireListings,
  priceAlerts,
  cleanup,
};

/** Run one named job once, recording a `JobRun`. Used by cron, the admin trigger and the CLI. */
export async function runJobByName(name: JobName): Promise<void> {
  await runJob(name, jobFn[name]);
}

const schedules: Record<JobName, string> = {
  expireListings: '0 * * * *', // hourly
  priceAlerts: '45 6 * * *', // 06:45 daily
  cleanup: '0 2 * * *', // 02:00 daily
};

let scheduledTasks: ScheduledTask[] = [];

/**
 * Start the cron schedule for every job. Guarded by `JOBS_ENABLED` at the
 * call site (see `index.ts`) - a second server instance, or a test run,
 * must not also be ticking these.
 */
export function registerJobs(): void {
  if (scheduledTasks.length > 0) return;

  scheduledTasks = JOB_NAMES.map((name) =>
    cron.schedule(schedules[name], () => void runJobByName(name), { timezone: 'Asia/Kolkata' }),
  );
  logger.info({ jobs: JOB_NAMES }, 'Scheduled jobs registered');
}

/** Stop every scheduled task, for graceful shutdown. */
export function stopJobs(): void {
  scheduledTasks.forEach((task) => task.stop());
  scheduledTasks = [];
}
