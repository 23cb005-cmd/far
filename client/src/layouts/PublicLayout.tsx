import { Menu } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router-dom';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { homePathFor, useUser } from '@/store/auth';

/** Marketing navigation. Anchors jump within the landing page. */
const links = [
  { to: '/#how', labelKey: 'nav.howItWorks' },
  { to: '/#features', labelKey: 'nav.features' },
] as const;

export function PublicLayout() {
  const { t } = useTranslation();
  const user = useUser();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label={t('a11y.mainNavigation')}>
            {links.map((link) => (
              <a
                key={link.to}
                href={link.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(link.labelKey)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <LanguageSwitch compact />
            <ThemeToggle />

            {user ? (
              <Button asChild size="sm" className="ml-1">
                <Link to={homePathFor(user.role)}>{t('nav.dashboard')}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/login">{t('nav.login')}</Link>
                </Button>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link to="/register">{t('nav.register')}</Link>
                </Button>
              </>
            )}

            {/* Mobile menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  aria-label={t('nav.openMenu')}
                >
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" closeLabel={t('nav.closeMenu')} className="w-72">
                <SheetHeader>
                  <SheetTitle>{t('nav.menu')}</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1" aria-label={t('a11y.mainNavigation')}>
                  {links.map((link) => (
                    <a
                      key={link.to}
                      href={link.to}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-md px-3 py-3 text-base font-medium hover:bg-secondary"
                    >
                      {t(link.labelKey)}
                    </a>
                  ))}
                  <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                    {user ? (
                      <Button asChild onClick={() => setMenuOpen(false)}>
                        <Link to={homePathFor(user.role)}>{t('nav.dashboard')}</Link>
                      </Button>
                    ) : (
                      <>
                        <Button asChild variant="outline" onClick={() => setMenuOpen(false)}>
                          <Link to="/login">{t('nav.login')}</Link>
                        </Button>
                        <Button asChild onClick={() => setMenuOpen(false)}>
                          <Link to="/register">{t('nav.register')}</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className={cn('transition-colors hover:text-foreground')}>
        {children}
      </Link>
    </li>
  );
}

export function PublicFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t bg-secondary/40">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {t('landing.footer.tagline')}
            </p>
          </div>

          <FooterColumn title={t('landing.footer.product')}>
            <FooterLink to="/register">{t('nav.register')}</FooterLink>
            <FooterLink to="/login">{t('nav.login')}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t('landing.footer.legal')}>
            <FooterLink to="/">{t('landing.footer.privacy')}</FooterLink>
            <FooterLink to="/">{t('landing.footer.terms')}</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} FarmFair. {t('landing.footer.rights')}
          </p>
          <p>{t('landing.footer.builtFor')}</p>
        </div>
      </div>
    </footer>
  );
}
