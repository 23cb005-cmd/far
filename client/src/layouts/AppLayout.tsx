import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingCart,
  Tags,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/components/NotificationBell';
import { PendingBuyerBanner } from '@/components/PendingBuyerBanner';
import { ThemeToggle } from '@/components/ThemeProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/hooks/useAuth';
import { cn, initials } from '@/lib/utils';
import { homePathFor, useUser } from '@/store/auth';

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Shown in the mobile bottom bar, which has room for four items. */
  primary?: boolean;
}

/** Navigation differs per role; later phases fill in the placeholder routes. */
function navFor(role: string | undefined): NavItem[] {
  switch (role) {
    case 'farmer':
      return [
        { to: '/app/farmer', labelKey: 'nav.dashboard', icon: LayoutDashboard, primary: true },
        { to: '/app/prices', labelKey: 'nav.prices', icon: TrendingUp, primary: true },
        { to: '/app/listings', labelKey: 'nav.myListings', icon: Tags, primary: true },
        { to: '/app/orders', labelKey: 'nav.orders', icon: Package },
        { to: '/app/whatsapp-help', labelKey: 'nav.whatsapp', icon: MessageCircle },
        { to: '/app/profile', labelKey: 'nav.profile', icon: UserIcon, primary: true },
      ];
    case 'buyer':
      return [
        { to: '/app/buyer', labelKey: 'nav.dashboard', icon: LayoutDashboard, primary: true },
        { to: '/app/browse', labelKey: 'nav.browse', icon: ShoppingCart, primary: true },
        { to: '/app/prices', labelKey: 'nav.prices', icon: TrendingUp, primary: true },
        { to: '/app/offers', labelKey: 'nav.myOffers', icon: Tags },
        { to: '/app/orders', labelKey: 'nav.orders', icon: Package },
        { to: '/app/profile', labelKey: 'nav.profile', icon: UserIcon, primary: true },
      ];
    case 'admin':
      return [
        { to: '/app/admin', labelKey: 'nav.dashboard', icon: ShieldCheck, primary: true },
        { to: '/app/prices', labelKey: 'nav.prices', icon: TrendingUp, primary: true },
        { to: '/app/profile', labelKey: 'nav.profile', icon: UserIcon, primary: true },
      ];
    default:
      return [];
  }
}

const SIDEBAR_KEY = 'farmfair.sidebarCollapsed';

export function AppLayout() {
  const { t } = useTranslation();
  const user = useUser();
  const logout = useLogout();

  const [collapsed, setCollapsed] = React.useState<boolean>(
    () => window.localStorage.getItem(SIDEBAR_KEY) === 'true',
  );

  const toggleSidebar = () => {
    setCollapsed((previous) => {
      window.localStorage.setItem(SIDEBAR_KEY, String(!previous));
      return !previous;
    });
  };

  const items = navFor(user?.role);
  const primaryItems = items.filter((item) => item.primary).slice(0, 4);

  return (
    <div className="flex min-h-dvh flex-col bg-secondary/30">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>

      {/* ---- top bar ---- */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-16 items-center gap-2 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleSidebar}
            aria-label={t('nav.toggleSidebar')}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="size-5" aria-hidden="true" />
            ) : (
              <ChevronLeft className="size-5" aria-hidden="true" />
            )}
          </Button>

          <Logo to={homePathFor(user?.role)} className="lg:hidden" iconOnly />
          <Logo to={homePathFor(user?.role)} className="hidden lg:flex" />

          <div className="flex-1" />

          <LanguageSwitch compact />
          <ThemeToggle />

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={t('a11y.profileMenu')}
              >
                <Avatar>
                  <AvatarFallback>{initials(user?.name ?? '?')}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate">{user?.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {user?.phone}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/profile">
                  <UserIcon aria-hidden="true" />
                  {t('nav.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout.mutate()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut aria-hidden="true" />
                {t('nav.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ---- sidebar (desktop) ---- */}
        <aside
          className={cn(
            'sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 border-r bg-background transition-[width] lg:block',
            collapsed ? 'w-16' : 'w-60',
          )}
        >
          <nav className="flex flex-col gap-1 p-2" aria-label={t('a11y.mainNavigation')}>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === homePathFor(user?.role)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    collapsed && 'justify-center px-2',
                  )
                }
                title={collapsed ? t(item.labelKey) : undefined}
              >
                <item.icon className="size-5 shrink-0" aria-hidden="true" />
                <span className={cn(collapsed && 'sr-only')}>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* ---- content ---- */}
        <main id="main" className="min-w-0 flex-1 pb-20 lg:pb-0">
          <div className="container max-w-6xl py-6">
            <PendingBuyerBanner />
            <Outlet />
          </div>
        </main>
      </div>

      {/* ---- bottom navigation (mobile) ---- */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background lg:hidden"
        aria-label={t('a11y.bottomNavigation')}
      >
        <ul className="flex">
          {primaryItems.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === homePathFor(user?.role)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                <item.icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate">{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
