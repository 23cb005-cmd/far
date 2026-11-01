import type { NotificationDto, Paginated, UnreadCountResponse } from '@farmfair/shared';
import { apiGet, apiPatch } from './api';

/** One place for every notification endpoint, so URLs are not scattered across pages. */
export const notificationsApi = {
  list: (page = 1, limit = 20, unreadOnly = false) =>
    apiGet<Paginated<NotificationDto>>('/notifications', { params: { page, limit, unreadOnly } }),

  unreadCount: () => apiGet<UnreadCountResponse>('/notifications/unread-count'),

  markRead: (id: string) => apiPatch<NotificationDto>(`/notifications/${id}/read`),

  markAllRead: () => apiPatch<null>('/notifications/read-all'),
};
