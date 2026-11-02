import { JOB_NAMES, type JobName, type UserDto, type VerificationStatus } from '@farmfair/shared';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  useAdminBotMessages,
  useAdminJobs,
  useAdminUsers,
  useRunJob,
  useSuspendUser,
  useUnsuspendUser,
  useVerifyBuyer,
} from '@/hooks/useAdmin';

type AdminTab = 'users' | 'jobs' | 'bot';

export default function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<AdminTab>('users');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('admin.subtitle')}</p>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)}>
        <TabsList>
          <TabsTrigger value="users">{t('admin.tabs.users')}</TabsTrigger>
          <TabsTrigger value="jobs">{t('admin.tabs.jobs')}</TabsTrigger>
          <TabsTrigger value="bot">{t('admin.tabs.bot')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'users' && <UsersTab />}
      {tab === 'jobs' && <JobsTab />}
      {tab === 'bot' && <BotMessagesTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab: verification queue + suspend/unsuspend
// ---------------------------------------------------------------------------

const ALL = 'all';

function UsersTab() {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');
  const [verificationStatus, setVerificationStatus] = React.useState<
    VerificationStatus | typeof ALL
  >(ALL);
  const [page, setPage] = React.useState(1);

  const users = useAdminUsers({
    page,
    limit: 20,
    search: search.trim() || undefined,
    verificationStatus: verificationStatus === ALL ? undefined : verificationStatus,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t('admin.users.searchPlaceholder')}
          className="max-w-xs"
        />
        <Select
          value={verificationStatus}
          onValueChange={(value) => {
            setVerificationStatus(value as VerificationStatus | typeof ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('admin.users.filterAll')}</SelectItem>
            <SelectItem value="pending">{t('admin.users.status.pending')}</SelectItem>
            <SelectItem value="approved">{t('admin.users.status.approved')}</SelectItem>
            <SelectItem value="rejected">{t('admin.users.status.rejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {users.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : users.data && users.data.items.length > 0 ? (
        <div className="space-y-3">
          {users.data.items.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.users.empty')}</p>
      )}

      {users.data && users.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={!users.data.meta.hasPrev}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('admin.users.pageOf', {
              page: users.data.meta.page,
              totalPages: users.data.meta.totalPages,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!users.data.meta.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}

function verificationBadgeVariant(status: VerificationStatus) {
  switch (status) {
    case 'approved':
      return 'success' as const;
    case 'rejected':
      return 'danger' as const;
    case 'pending':
      return 'warning' as const;
    default:
      return 'secondary' as const;
  }
}

function UserRow({ user }: { user: UserDto }) {
  const { t } = useTranslation();
  const errorMessage = useApiErrorMessage();
  const verify = useVerifyBuyer();
  const suspend = useSuspendUser();
  const unsuspend = useUnsuspendUser();
  const [suspending, setSuspending] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const mutationError = verify.isError
    ? verify.error
    : suspend.isError
      ? suspend.error
      : unsuspend.isError
        ? unsuspend.error
        : undefined;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{user.name}</span>
              <Badge variant="outline">{t(`roles.${user.role}`)}</Badge>
              {user.role === 'buyer' && (
                <Badge variant={verificationBadgeVariant(user.verificationStatus)}>
                  {t(`admin.users.status.${user.verificationStatus}`)}
                </Badge>
              )}
              {user.isSuspended && <Badge variant="danger">{t('admin.users.suspended')}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {user.phone} · {user.district}
            </p>
            {user.isSuspended && user.suspensionReason && (
              <p className="mt-1 text-xs italic text-muted-foreground">
                &ldquo;{user.suspensionReason}&rdquo;
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user.role === 'buyer' && user.verificationStatus === 'pending' && (
              <>
                <Button
                  size="sm"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate(
                      { id: user.id, status: 'approved' },
                      { onSuccess: () => toast.success(t('admin.users.approvedToast')) },
                    )
                  }
                >
                  {t('admin.users.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={verify.isPending}
                  onClick={() =>
                    verify.mutate(
                      { id: user.id, status: 'rejected' },
                      { onSuccess: () => toast.success(t('admin.users.rejectedToast')) },
                    )
                  }
                >
                  {t('admin.users.reject')}
                </Button>
              </>
            )}

            {user.role !== 'admin' &&
              (user.isSuspended ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unsuspend.isPending}
                  onClick={() =>
                    unsuspend.mutate(user.id, {
                      onSuccess: () => toast.success(t('admin.users.unsuspendedToast')),
                    })
                  }
                >
                  {unsuspend.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {t('admin.users.unsuspend')}
                </Button>
              ) : (
                <Dialog open={suspending} onOpenChange={setSuspending}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      {t('admin.users.suspend')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {t('admin.users.suspendTitle', { name: user.name })}
                      </DialogTitle>
                    </DialogHeader>
                    <Textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={t('admin.users.suspendReasonPlaceholder')}
                      rows={3}
                    />
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        disabled={suspend.isPending || reason.trim().length === 0}
                        onClick={() =>
                          suspend.mutate(
                            { id: user.id, reason: reason.trim() },
                            {
                              onSuccess: () => {
                                toast.success(t('admin.users.suspendedToast'));
                                setSuspending(false);
                                setReason('');
                              },
                            },
                          )
                        }
                      >
                        {suspend.isPending && (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        )}
                        {t('admin.users.suspendConfirm')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ))}
          </div>
        </div>

        {mutationError && <p className="text-sm text-danger">{errorMessage(mutationError)}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Jobs tab
// ---------------------------------------------------------------------------

function JobsTab() {
  const { t } = useTranslation();
  const jobs = useAdminJobs();
  const runJob = useRunJob();
  const [running, setRunning] = React.useState<JobName | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {JOB_NAMES.map((name) => (
          <Button
            key={name}
            size="sm"
            variant="outline"
            disabled={runJob.isPending}
            onClick={() => {
              setRunning(name);
              runJob.mutate(name, {
                onSuccess: () => toast.success(t('admin.jobs.ranToast', { name })),
                onSettled: () => setRunning(null),
              });
            }}
          >
            {running === name && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t('admin.jobs.run', { name })}
          </Button>
        ))}
      </div>

      {jobs.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : jobs.data && jobs.data.items.length > 0 ? (
        <div className="space-y-2">
          {jobs.data.items.map((run) => (
            <Card key={run.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div>
                  <span className="font-medium">{run.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString()}
                    {run.summary ? ` · ${run.summary}` : ''}
                    {run.error ? ` · ${run.error}` : ''}
                  </p>
                </div>
                <Badge
                  variant={
                    run.status === 'success'
                      ? 'success'
                      : run.status === 'failed'
                        ? 'danger'
                        : 'info'
                  }
                >
                  {t(`admin.jobs.status.${run.status}`)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.jobs.empty')}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bot messages tab
// ---------------------------------------------------------------------------

function BotMessagesTab() {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const messages = useAdminBotMessages(page, 20);

  return (
    <div className="space-y-4">
      {messages.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : messages.data && messages.data.items.length > 0 ? (
        <div className="space-y-2">
          {messages.data.items.map((message) => (
            <Card key={message.id}>
              <CardContent className="space-y-1 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{message.phone}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{message.body}</p>
                <p className="text-xs text-muted-foreground">{message.outcome}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.bot.empty')}</p>
      )}

      {messages.data && messages.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={!messages.data.meta.hasPrev}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('admin.users.pageOf', {
              page: messages.data.meta.page,
              totalPages: messages.data.meta.totalPages,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!messages.data.meta.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
