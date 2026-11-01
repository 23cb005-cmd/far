import { jobNameParamSchema, type JobRunDto } from '@farmfair/shared';
import { currentUser } from '../middleware/auth';
import { runJobByName } from '../jobs';
import { getLatestJobRun, getRecentJobRuns } from '../services/adminJobs';
import { recordAudit } from '../services/audit';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/respond';

/** GET /admin/jobs */
export const getJobsHandler = asyncHandler(async (_req, res) => {
  const items: JobRunDto[] = await getRecentJobRuns();
  sendSuccess(res, { items });
});

/** POST /admin/jobs/:name/run */
export const runJobHandler = asyncHandler(async (req, res) => {
  const admin = currentUser(req);
  const { name } = jobNameParamSchema.parse(req.params);

  await runJobByName(name);

  await recordAudit({
    actor: admin._id,
    action: 'admin.job.run',
    entity: 'JobRun',
    entityId: name,
    req,
  });

  const latest = await getLatestJobRun(name);
  sendSuccess(res, latest);
});
