import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { t } = useTranslation();
  const unread = useUnreadCount();
  const notifications = useNotifications(1, 10);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const count = unread.data?.count ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            count > 0 ? t('notifications.bellUnread', { count }) : t('a11y.notifications')
          }
        >
          <Bell className="size-5" aria-hidden="true" />
          {count > 0 && (
            <Badge
              variant="danger"
              className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full p-0 text-[10px] leading-none"
            >
              {count > 9 ? '9+' : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <DropdownMenuLabel className="p-0">{t('notifications.title')}</DropdownMenuLabel>
          {count > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notifications.isLoading ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </p>
        ) : notifications.data && notifications.data.items.length > 0 ? (
          notifications.data.items.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={cn(
                'flex flex-col items-start gap-0.5 whitespace-normal py-2',
                !notification.read && 'bg-primary/5',
              )}
              onSelect={(event) => {
                event.preventDefault();
                if (!notification.read) markRead.mutate(notification.id);
              }}
            >
              <span className="text-sm font-medium">{notification.title}</span>
              <span className="text-xs text-muted-foreground">{notification.message}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('notifications.empty')}
          </p>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/notifications" className="justify-center text-sm">
            {t('notifications.viewAll')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
