import {
  notificationsFiltersSchema,
  type NotificationDto,
  type Paginated,
  type UnreadCountResponse,
} from '@farmfair/shared';
import { currentUser } from '../middleware/auth';
import {
  getMyNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/respond';

/** GET /notifications */
export const getMyNotificationsHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const { page, limit, unreadOnly } = notificationsFiltersSchema.parse(req.query);
  const body: Paginated<NotificationDto> = await getMyNotifications(
    user._id,
    page,
    limit,
    unreadOnly,
  );
  sendSuccess(res, body);
});

/** GET /notifications/unread-count */
export const getUnreadCountHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const count = await getUnreadCount(user._id);
  const body: UnreadCountResponse = { count };
  sendSuccess(res, body);
});

/** PATCH /notifications/:id/read */
export const markNotificationReadHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const notification: NotificationDto = await markNotificationRead(user._id, req.params.id!);
  sendSuccess(res, notification);
});

/** PATCH /notifications/read-all */
export const markAllNotificationsReadHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  await markAllNotificationsRead(user._id);
  sendSuccess(res, null);
});
