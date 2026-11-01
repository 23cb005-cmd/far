import type { NotificationDto, NotificationType, Paginated } from '@farmfair/shared';
import type { Types } from 'mongoose';
import { logger } from '../config/logger';
import { Notification, type NotificationDocument } from '../models/Notification';
import { User } from '../models/User';
import { renderNotification, type NotificationParamsByType } from '../notifications/templates';
import { getNotifyProvider } from '../providers/notify';
import { AppError } from '../utils/AppError';
import { paginated } from '../utils/respond';

function toNotificationDto(notification: NotificationDocument): NotificationDto {
  return {
    id: String(notification._id),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    ...(notification.data ? { data: notification.data } : {}),
    read: notification.read,
    ...(notification.readAt ? { readAt: notification.readAt.toISOString() } : {}),
    createdAt: notification.createdAt.toISOString(),
  };
}

/**
 * Save an in-app notification and, if the user has opted in, attempt to also
 * send it over WhatsApp.
 *
 * Never throws: a notification failing to send must not fail the action that
 * triggered it (accepting an offer, confirming a pickup, ...). Failures are
 * logged instead.
 */
export async function notify<T extends NotificationType>(
  userId: Types.ObjectId | string,
  type: T,
  params: NotificationParamsByType[T],
  data?: Record<string, string | number>,
): Promise<void> {
  try {
    const user = await User.findById(userId).select('language phone notifyWhatsApp').exec();
    if (!user) return;

    const { title, message } = renderNotification(type, params, user.language);

    const notification = await Notification.create({
      user: user._id,
      type,
      title,
      message,
      ...(data ? { data } : {}),
    });

    if (user.notifyWhatsApp) {
      const notifyProvider = getNotifyProvider();
      const result = await notifyProvider.sendWhatsApp({ to: user.phone, body: message });
      if (result.delivered && notifyProvider.name !== 'console') {
        notification.whatsappSent = true;
        await notification.save();
      }
    }
  } catch (error) {
    logger.error({ err: (error as Error).message, type }, 'Failed to send notification');
  }
}

export async function getMyNotifications(
  userId: Types.ObjectId,
  page: number,
  limit: number,
  unreadOnly: boolean,
): Promise<Paginated<NotificationDto>> {
  const query = { user: userId, ...(unreadOnly ? { read: false } : {}) };

  const [total, notifications] = await Promise.all([
    Notification.countDocuments(query),
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
  ]);

  return paginated(notifications.map(toNotificationDto), page, limit, total);
}

export async function getUnreadCount(userId: Types.ObjectId): Promise<number> {
  return Notification.countDocuments({ user: userId, read: false });
}

export async function markNotificationRead(
  userId: Types.ObjectId,
  notificationId: string,
): Promise<NotificationDto> {
  const notification = await Notification.findOne({ _id: notificationId, user: userId }).exec();
  if (!notification) throw AppError.notFound('Notification not found');

  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return toNotificationDto(notification);
}

export async function markAllNotificationsRead(userId: Types.ObjectId): Promise<void> {
  await Notification.updateMany({ user: userId, read: false }, { read: true, readAt: new Date() });
}
