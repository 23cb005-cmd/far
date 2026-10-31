import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthBootstrap, useSessionExpiryRedirect } from '@/hooks/useAuth';
import { AppLayout } from '@/layouts/AppLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { RequireAuth, RedirectIfAuthenticated } from '@/routes/RequireAuth';
import { useTheme } from '@/components/ThemeProvider';

/**
 * Pages are code-split by route so the landing page - the one a farmer on a
 * 3G connection hits first - does not download the whole app.
 */
const LandingPage = React.lazy(() => import('@/pages/LandingPage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/RegisterPage'));
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage'));
const PricesPage = React.lazy(() => import('@/pages/PricesPage'));
const ListingsPage = React.lazy(() => import('@/pages/ListingsPage'));
const BrowsePage = React.lazy(() => import('@/pages/BrowsePage'));
const OffersPage = React.lazy(() => import('@/pages/OffersPage'));
const NotFoundPage = React.lazy(() => import('@/pages/NotFoundPage'));
const DashboardPlaceholders = React.lazy(() => import('@/pages/DashboardPlaceholders'));
const ComingSoonPage = React.lazy(() => import('@/pages/ComingSoonPage'));

function RouteSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

export default function App() {
  // Restores the session from the httpOnly cookie before any route renders.
  useAuthBootstrap();
  useSessionExpiryRedirect();
  const { resolved } = useTheme();

  return (
    <>
      <React.Suspense fallback={<RouteSpinner />}>
        <Routes>
          {/* ---- public ---- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>

          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <RegisterPage />
              </RedirectIfAuthenticated>
            }
          />

          {/* ---- signed in ---- */}
          <Route path="/app" element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/app/profile" replace />} />
              <Route path="profile" element={<ProfilePage />} />

              <Route
                path="farmer"
                element={
                  <RequireAuth roles={['farmer']}>
                    <DashboardPlaceholders forRole="farmer" />
                  </RequireAuth>
                }
              />
              <Route
                path="buyer"
                element={
                  <RequireAuth roles={['buyer']}>
                    <DashboardPlaceholders forRole="buyer" />
                  </RequireAuth>
                }
              />
              <Route
                path="admin"
                element={
                  <RequireAuth roles={['admin']}>
                    <DashboardPlaceholders forRole="admin" />
                  </RequireAuth>
                }
              />

              {/*
                Placeholders for the sections the sidebar already advertises.
                These routes must exist even before their features do: without
                them, clicking a nav item drops a signed-in user onto the
                public 404 page, which reads as broken rather than unfinished.
                Each is replaced by the real page in the phase noted.
              */}
              <Route path="prices" element={<PricesPage />} />
              <Route
                path="listings"
                element={
                  <RequireAuth roles={['farmer']}>
                    <ListingsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="browse"
                element={
                  <RequireAuth roles={['buyer']}>
                    <BrowsePage />
                  </RequireAuth>
                }
              />
              <Route
                path="offers"
                element={
                  <RequireAuth roles={['buyer']}>
                    <OffersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="orders"
                element={
                  <RequireAuth roles={['farmer', 'buyer']}>
                    <ComingSoonPage titleKey="nav.orders" bodyKey="comingSoon.orders" phase={4} />
                  </RequireAuth>
                }
              />
              <Route
                path="notifications"
                element={
                  <ComingSoonPage
                    titleKey="nav.notifications"
                    bodyKey="comingSoon.notifications"
                    phase={5}
                  />
                }
              />

              {/* An unknown path under /app keeps the app shell and sidebar. */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          {/* ---- 404 ---- */}
          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </React.Suspense>

      <Toaster
        position="top-center"
        theme={resolved}
        richColors
        closeButton
        // Toasts are supplementary; the same information is always available in
        // the page itself, so they stay short.
        duration={4000}
      />
    </>
  );
}
