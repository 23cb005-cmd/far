import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const notifications = useNotifications(1, 50, unreadOnly);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('notifications.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('notifications.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          {t('notifications.markAllRead')}
        </Button>
      </header>

      <Tabs
        value={unreadOnly ? 'unread' : 'all'}
        onValueChange={(value) => setUnreadOnly(value === 'unread')}
      >
        <TabsList>
          <TabsTrigger value="all">{t('notifications.tabs.all')}</TabsTrigger>
          <TabsTrigger value="unread">{t('notifications.tabs.unread')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {notifications.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : notifications.data && notifications.data.items.length > 0 ? (
        <div className="space-y-3">
          {notifications.data.items.map((notification) => (
            <Card
              key={notification.id}
              className={cn(!notification.read && 'border-primary/40 bg-primary/5')}
            >
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markRead.mutate(notification.id)}
                  >
                    {t('notifications.markRead')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {unreadOnly ? t('notifications.emptyUnread') : t('notifications.empty')}
        </p>
      )}
    </div>
  );
}
