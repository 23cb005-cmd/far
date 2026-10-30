import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { homePathFor, useUser } from '@/store/auth';

/**
 * Rendered both inside the public layout and nested under `/app`, so the
 * "go back" link points at the signed-in user's dashboard when there is one
 * and at the landing page otherwise.
 */
export default function NotFoundPage() {
  const { t } = useTranslation();
  const user = useUser();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="mb-6 flex size-16 items-center justify-center rounded-full bg-secondary"
        aria-hidden="true"
      >
        <Compass className="size-7 text-muted-foreground" />
      </div>

      <p className="text-5xl font-bold text-primary/30" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{t('errors.notFound.title')}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t('errors.notFound.body')}</p>

      <Button asChild className="mt-8">
        <Link to={user ? homePathFor(user.role) : '/'}>
          {user ? t('errors.notFound.dashboard') : t('errors.notFound.home')}
        </Link>
      </Button>
    </div>
  );
}
