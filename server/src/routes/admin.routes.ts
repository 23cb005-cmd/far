import { jobNameParamSchema, paginationSchema } from '@farmfair/shared';
import { Router } from 'express';
import {
  getBotMessagesHandler,
  getJobsHandler,
  runJobHandler,
} from '../controllers/admin.controller';
import { blockSuspended, requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'), blockSuspended);

adminRouter.get('/jobs', getJobsHandler);

adminRouter.post('/jobs/:name/run', validate({ params: jobNameParamSchema }), runJobHandler);

adminRouter.get('/bot-messages', validate({ query: paginationSchema }), getBotMessagesHandler);
