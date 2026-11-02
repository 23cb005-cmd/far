import {
  adminUsersFiltersSchema,
  idParamSchema,
  jobNameParamSchema,
  paginationSchema,
  suspendUserSchema,
  verifyBuyerSchema,
  type InboundMessageDto,
  type JobRunDto,
  type Paginated,
  type UserDto,
} from '@farmfair/shared';
import { currentUser } from '../middleware/auth';
import { runJobByName } from '../jobs';
import { getRecentBotMessages } from '../services/adminBot';
import { getLatestJobRun, getRecentJobRuns } from '../services/adminJobs';
import { listUsers, suspendUser, unsuspendUser, verifyBuyer } from '../services/adminUsers';
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

/** GET /admin/bot-messages */
export const getBotMessagesHandler = asyncHandler(async (req, res) => {
  const { page, limit } = paginationSchema.parse(req.query);
  const body: Paginated<InboundMessageDto> = await getRecentBotMessages(page, limit);
  sendSuccess(res, body);
});

/** GET /admin/users */
export const getUsersHandler = asyncHandler(async (req, res) => {
  const filters = adminUsersFiltersSchema.parse(req.query);
  const body: Paginated<UserDto> = await listUsers(filters);
  sendSuccess(res, body);
});

/** PATCH /admin/users/:id/verify */
export const verifyBuyerHandler = asyncHandler(async (req, res) => {
  const admin = currentUser(req);
  const { id } = idParamSchema.parse(req.params);
  const input = verifyBuyerSchema.parse(req.body);

  const user: UserDto = await verifyBuyer(id, input);

  await recordAudit({
    actor: admin._id,
    action: 'admin.user.verify',
    entity: 'User',
    entityId: id,
    metadata: { status: input.status },
    req,
  });

  sendSuccess(res, user);
});

/** PATCH /admin/users/:id/suspend */
export const suspendUserHandler = asyncHandler(async (req, res) => {
  const admin = currentUser(req);
  const { id } = idParamSchema.parse(req.params);
  const input = suspendUserSchema.parse(req.body);

  const user: UserDto = await suspendUser(id, input);

  await recordAudit({
    actor: admin._id,
    action: 'admin.user.suspend',
    entity: 'User',
    entityId: id,
    metadata: { reason: input.reason },
    req,
  });

  sendSuccess(res, user);
});

/** PATCH /admin/users/:id/unsuspend */
export const unsuspendUserHandler = asyncHandler(async (req, res) => {
  const admin = currentUser(req);
  const { id } = idParamSchema.parse(req.params);

  const user: UserDto = await unsuspendUser(id);

  await recordAudit({
    actor: admin._id,
    action: 'admin.user.unsuspend',
    entity: 'User',
    entityId: id,
    req,
  });

  sendSuccess(res, user);
});
