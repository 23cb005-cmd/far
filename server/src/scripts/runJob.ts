/**
 * Run one scheduled job once, outside its cron schedule.
 *
 *   npm run job -- expireListings
 *
 * Useful locally (no need to wait for the hourly/daily tick) and in
 * production for an ad-hoc run from a shell on the box.
 */
import { JOB_NAMES, type JobName } from '@farmfair/shared';
import { connectDb, disconnectDb } from '../config/db';
import { runJobByName } from '../jobs';
import { JobRun } from '../models/JobRun';

function isJobName(value: string | undefined): value is JobName {
  return JOB_NAMES.includes(value as JobName);
}

async function main(): Promise<void> {
  const name = process.argv[2];
  if (!isJobName(name)) {
    console.error(`Usage: npm run job -- <name>\nAvailable jobs: ${JOB_NAMES.join(', ')}`);
    process.exit(1);
  }

  await connectDb();
  await runJobByName(name);

  const run = await JobRun.findOne({ name }).sort({ startedAt: -1 }).exec();
  console.log(`\n${name}: ${run?.status ?? 'unknown'}`);
  if (run?.summary) console.log(run.summary);
  if (run?.error) console.error(run.error);
}

main()
  .then(async () => {
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}\n`);
    await disconnectDb().catch(() => undefined);
    process.exit(1);
  });
