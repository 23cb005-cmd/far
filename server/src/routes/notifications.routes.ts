import { idParamSchema, notificationsFiltersSchema } from '@farmfair/shared';
import { Router } from 'express';
import {
  getMyNotificationsHandler,
  getUnreadCountHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
} from '../controllers/notifications.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  requireAuth,
  validate({ query: notificationsFiltersSchema }),
  getMyNotificationsHandler,
);

notificationsRouter.get('/unread-count', requireAuth, getUnreadCountHandler);

notificationsRouter.patch(
  '/:id/read',
  requireAuth,
  validate({ params: idParamSchema }),
  markNotificationReadHandler,
);

notificationsRouter.patch('/read-all', requireAuth, markAllNotificationsReadHandler);
