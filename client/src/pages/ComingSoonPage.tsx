import { ArrowLeft, Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { homePathFor, useUser } from '@/store/auth';

interface ComingSoonPageProps {
  /** i18n key for the section heading, e.g. `nav.prices`. */
  titleKey: string;
  /** i18n key describing what will eventually live here. */
  bodyKey: string;
  /** Which build phase delivers this section. */
  phase: number;
}

/**
 * Placeholder for a navigation entry whose feature has not been built yet.
 *
 * The sidebar deliberately shows the full product shape from day one, so these
 * routes must exist: without them a signed-in user clicking "Mandi prices"
 * falls through to the public 404 page, complete with Log in / Sign up buttons,
 * which reads as a broken app rather than an unfinished one.
 */
export default function ComingSoonPage({ titleKey, bodyKey, phase }: ComingSoonPageProps) {
  const { t } = useTranslation();
  const user = useUser();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t(titleKey)}</h1>
      </header>

      <Card className="border-dashed">
        <CardHeader>
          <div
            className="mb-2 flex size-11 items-center justify-center rounded-full bg-secondary"
            aria-hidden="true"
          >
            <Construction className="size-5 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t('comingSoon.title')}</CardTitle>
            <Badge variant="secondary">{t('comingSoon.phase', { phase })}</Badge>
          </div>
          <CardDescription>{t(bodyKey)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to={homePathFor(user?.role)}>
              <ArrowLeft aria-hidden="true" />
              {t('comingSoon.back')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
