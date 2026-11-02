import {
  adminUsersFiltersSchema,
  idParamSchema,
  jobNameParamSchema,
  paginationSchema,
  suspendUserSchema,
  verifyBuyerSchema,
} from '@farmfair/shared';
import { Router } from 'express';
import {
  getBotMessagesHandler,
  getJobsHandler,
  getUsersHandler,
  runJobHandler,
  suspendUserHandler,
  unsuspendUserHandler,
  verifyBuyerHandler,
} from '../controllers/admin.controller';
import { blockSuspended, requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'), blockSuspended);

adminRouter.get('/jobs', getJobsHandler);

adminRouter.post('/jobs/:name/run', validate({ params: jobNameParamSchema }), runJobHandler);

adminRouter.get('/bot-messages', validate({ query: paginationSchema }), getBotMessagesHandler);

adminRouter.get('/users', validate({ query: adminUsersFiltersSchema }), getUsersHandler);

adminRouter.patch(
  '/users/:id/verify',
  validate({ params: idParamSchema, body: verifyBuyerSchema }),
  verifyBuyerHandler,
);

adminRouter.patch(
  '/users/:id/suspend',
  validate({ params: idParamSchema, body: suspendUserSchema }),
  suspendUserHandler,
);

adminRouter.patch(
  '/users/:id/unsuspend',
  validate({ params: idParamSchema }),
  unsuspendUserHandler,
);
