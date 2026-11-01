import type { JobName } from '@farmfair/shared';
import { logger } from '../config/logger';
import { JobRun } from '../models/JobRun';

export interface JobResult {
  summary: string;
}

/**
 * Run one job, recording a `JobRun` for it regardless of outcome.
 *
 * A job failing must never crash the cron process or a manual admin
 * trigger - the error is captured on the run record and logged instead.
 */
export async function runJob(name: JobName, fn: () => Promise<JobResult>): Promise<void> {
  const run = await JobRun.create({ name, status: 'running', startedAt: new Date() });

  try {
    const { summary } = await fn();
    run.status = 'success';
    run.summary = summary;
    run.finishedAt = new Date();
    await run.save();
    logger.info({ job: name, summary }, `[job] ${name} succeeded`);
  } catch (error) {
    run.status = 'failed';
    run.error = (error as Error).message;
    run.finishedAt = new Date();
    await run.save();
    logger.error({ job: name, err: (error as Error).message }, `[job] ${name} failed`);
  }
}
