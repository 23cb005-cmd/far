import {
  ArrowRight,
  BadgeIndianRupee,
  ClipboardList,
  Gauge,
  Languages,
  LineChart,
  MessageCircle,
  Scale,
  ShieldCheck,
  Sprout,
  Star,
  TrendingDown,
  Truck,
  Users,
} from 'lucide-react';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type IconType = React.ComponentType<{ className?: string }>;

const problems: Array<{ key: string; icon: IconType }> = [
  { key: 'price', icon: TrendingDown },
  { key: 'middlemen', icon: Users },
  { key: 'trust', icon: BadgeIndianRupee },
  { key: 'reach', icon: Truck },
];

const steps: Array<{ key: string; icon: IconType }> = [
  { key: 'one', icon: LineChart },
  { key: 'two', icon: ClipboardList },
  { key: 'three', icon: Scale },
  { key: 'four', icon: ShieldCheck },
];

const features: Array<{ key: string; icon: IconType }> = [
  { key: 'prices', icon: LineChart },
  { key: 'fairness', icon: Gauge },
  { key: 'escrow', icon: ShieldCheck },
  { key: 'whatsapp', icon: MessageCircle },
  { key: 'tamil', icon: Languages },
  { key: 'ratings', icon: Star },
];

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.07] via-background to-background">
        <div className="container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="success" className="mb-5">
              <Sprout aria-hidden="true" />
              {t('landing.hero.badge')}
            </Badge>

            <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t('landing.hero.title')}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              {t('landing.hero.subtitle')}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link to="/register?role=farmer">
                  {t('landing.hero.ctaFarmer')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/register?role=buyer">{t('landing.hero.ctaBuyer')}</Link>
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">{t('landing.hero.trust')}</p>
          </div>
        </div>
      </section>

      {/* ---------------- problem ---------------- */}
      <section className="container py-16 md:py-20" aria-labelledby="problem-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="problem-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('landing.problem.title')}
          </h2>
          <p className="mt-3 text-muted-foreground">{t('landing.problem.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {problems.map(({ key, icon: Icon }) => (
            <Card key={key} className="border-l-4 border-l-destructive/60">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-danger-muted"
                    aria-hidden="true"
                  >
                    <Icon className="size-5 text-danger" />
                  </span>
                  <CardTitle className="pt-1.5 text-base">
                    {t(`landing.problem.items.${key}.title`)}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t(`landing.problem.items.${key}.body`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section
        id="how"
        className="scroll-mt-20 border-y bg-secondary/40 py-16 md:py-20"
        aria-labelledby="how-heading"
      >
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="how-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t('landing.how.title')}
            </h2>
            <p className="mt-3 text-muted-foreground">{t('landing.how.subtitle')}</p>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ key, icon: Icon }, index) => (
              <li key={key} className="relative">
                <div className="flex h-full flex-col rounded-lg border bg-background p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      aria-hidden="true"
                    >
                      <Icon className="size-5" />
                    </span>
                    <span
                      className="text-3xl font-bold text-primary/20 tabular-nums"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="font-semibold">{t(`landing.how.steps.${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`landing.how.steps.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- features ---------------- */}
      <section
        id="features"
        className="container scroll-mt-20 py-16 md:py-20"
        aria-labelledby="features-heading"
      >
        <h2
          id="features-heading"
          className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {t('landing.features.title')}
        </h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <Card key={key} className="transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <span
                  className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10"
                  aria-hidden="true"
                >
                  <Icon className="size-5 text-primary" />
                </span>
                <h3 className="font-semibold">{t(`landing.features.items.${key}.title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`landing.features.items.${key}.body`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------- call to action ---------------- */}
      <section className="border-t bg-primary py-16 text-primary-foreground md:py-20">
        <div className="container text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('landing.cta.title')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            {t('landing.cta.subtitle')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" variant="accent">
              <Link to="/register">
                {t('landing.cta.button')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/login">{t('landing.cta.secondary')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
