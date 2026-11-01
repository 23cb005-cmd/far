import { JOB_NAMES, JOB_RUN_STATUSES, type JobName, type JobRunStatus } from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/**
 * One execution record for a scheduled job, whether it fired on its cron
 * schedule or was triggered manually from the admin endpoint.
 *
 * There is deliberately no distributed lock here: the deployment runs a
 * single server instance (see `JOBS_ENABLED` in `.env.example`), so two
 * processes racing to run the same job at once is not a case that needs
 * guarding against yet.
 */
export interface JobRunDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  name: JobName;
  status: JobRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  summary?: string;
  error?: string;
}

export type JobRunModel = Model<JobRunDocument>;

const jobRunSchema = new Schema<JobRunDocument, JobRunModel>({
  name: { type: String, enum: JOB_NAMES, required: true, index: true },
  status: { type: String, enum: JOB_RUN_STATUSES, required: true, default: 'running' },
  startedAt: { type: Date, required: true, default: Date.now },
  finishedAt: { type: Date },
  summary: { type: String, trim: true, maxlength: 500 },
  error: { type: String, trim: true, maxlength: 500 },
});

// Backs the admin "last runs per job" view.
jobRunSchema.index({ name: 1, startedAt: -1 });

export const JobRun = model<JobRunDocument, JobRunModel>('JobRun', jobRunSchema);
