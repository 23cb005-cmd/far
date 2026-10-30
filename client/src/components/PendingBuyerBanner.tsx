import { Clock, PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/store/auth';

/**
 * Explains to a pending buyer exactly what they can and cannot do.
 *
 * Shown on every signed-in page rather than only on the dashboard, because the
 * restriction only becomes visible when they try to make an offer, and
 * discovering it then feels like a bug.
 */
export function PendingBuyerBanner() {
  const { t } = useTranslation();
  const user = useUser();

  const showVerification = user?.role === 'buyer' && user.verificationStatus === 'pending';
  const showPhone = Boolean(user && !user.phoneVerified);

  if (!showVerification && !showPhone) return null;

  return (
    <div className="mb-6 space-y-3">
      {showVerification && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-muted p-4 sm:flex-row sm:items-start"
        >
          <Clock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{t('banner.pendingBuyer.title')}</p>
            <p className="text-sm text-muted-foreground">{t('banner.pendingBuyer.body')}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 bg-background">
            <Link to="/app/profile">{t('banner.pendingBuyer.action')}</Link>
          </Button>
        </div>
      )}

      {showPhone && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-info/40 bg-info-muted p-4 sm:flex-row sm:items-start"
        >
          <PhoneCall className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{t('banner.unverifiedPhone.title')}</p>
            <p className="text-sm text-muted-foreground">{t('banner.unverifiedPhone.body')}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 bg-background">
            <Link to="/app/profile?tab=phone">{t('banner.unverifiedPhone.action')}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
