import type { Role } from '@farmfair/shared';
import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/store/auth';

/**
 * Role dashboards.
 *
 * Phases 2-5 replace the placeholder card with price widgets, listings, offers
 * and order summaries. The page shell, heading and routing are already final,
 * so those phases only add content.
 */
export default function DashboardPlaceholders({ forRole }: { forRole: Role }) {
  const role = forRole;
  const { t } = useTranslation();
  const user = useUser();

  const title = t(`dashboard.${role}.title`);
  const welcome =
    role === 'admin'
      ? t('dashboard.admin.welcome')
      : t(`dashboard.${role}.welcome`, { name: user?.name ?? '' });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{welcome}</p>
      </header>

      <Card className="border-dashed">
        <CardHeader>
          <div
            className="mb-2 flex size-11 items-center justify-center rounded-full bg-secondary"
            aria-hidden="true"
          >
            <Construction className="size-5 text-muted-foreground" />
          </div>
          <CardTitle>{t('dashboard.placeholder.title')}</CardTitle>
          <CardDescription>{t('dashboard.placeholder.body')}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
