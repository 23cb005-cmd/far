import type { NotificationDto, Paginated, UnreadCountResponse } from '@farmfair/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiRequestError } from '@/lib/api';
import { notificationsApi } from '@/lib/notificationsApi';

export function useNotifications(page = 1, limit = 20, unreadOnly = false) {
  return useQuery<Paginated<NotificationDto>, ApiRequestError>({
    queryKey: ['notifications', 'list', page, limit, unreadOnly],
    queryFn: () => notificationsApi.list(page, limit, unreadOnly),
  });
}

/** Polled so the bell badge stays current without the user reloading the page. */
export function useUnreadCount() {
  return useQuery<UnreadCountResponse, ApiRequestError>({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation<NotificationDto, ApiRequestError, string>({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation<null, ApiRequestError, void>({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
