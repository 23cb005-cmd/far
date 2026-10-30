import type { Role } from '@farmfair/shared';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homePathFor, useAuthStore } from '@/store/auth';

interface RequireAuthProps {
  /** When given, only these roles may enter. Omit to require any signed-in user. */
  roles?: Role[];
  children?: React.ReactNode;
}

function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

/**
 * Route guard.
 *
 * This is a usability control, not a security one: every protected endpoint is
 * independently authorised on the server. Its job is to avoid showing a
 * signed-out visitor an empty dashboard, and to send a user who lands on the
 * wrong role's page to their own.
 */
export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { user, initialising } = useAuthStore();
  const location = useLocation();

  // Wait for the first /auth/me to resolve, otherwise a page refresh would
  // bounce a signed-in user to the login screen.
  if (initialising) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

/** Keeps a signed-in user away from the login and register pages. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { user, initialising } = useAuthStore();

  if (initialising) return <FullPageSpinner />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  return <>{children}</>;
}
