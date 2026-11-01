import { JOB_NAMES, type JobRunDto } from '@farmfair/shared';
import { JobRun, type JobRunDocument } from '../models/JobRun';

function toJobRunDto(run: JobRunDocument): JobRunDto {
  return {
    id: String(run._id),
    name: run.name,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    ...(run.finishedAt ? { finishedAt: run.finishedAt.toISOString() } : {}),
    ...(run.summary ? { summary: run.summary } : {}),
    ...(run.error ? { error: run.error } : {}),
  };
}

/** The most recent runs of every job, newest first, for the admin jobs monitor. */
export async function getRecentJobRuns(limitPerJob = 5): Promise<JobRunDto[]> {
  const runsByJob = await Promise.all(
    JOB_NAMES.map((name) =>
      JobRun.find({ name }).sort({ startedAt: -1 }).limit(limitPerJob).exec(),
    ),
  );

  return runsByJob
    .flat()
    .map(toJobRunDto)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** The single most recent run of one job, or `undefined` if it has never run. */
export async function getLatestJobRun(name: JobRunDto['name']): Promise<JobRunDto | undefined> {
  const run = await JobRun.findOne({ name }).sort({ startedAt: -1 }).exec();
  return run ? toJobRunDto(run) : undefined;
}
