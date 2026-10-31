import {
  CROPS,
  FAIR_PRICE_TOLERANCE_PERCENT,
  TN_DISTRICTS,
  fairPriceCheckSchema,
  getCropName,
  type FairPriceVerdict,
} from '@farmfair/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PriceTicker } from '@/components/PriceTicker';
import { PriceTrendChart } from '@/components/PriceTrendChart';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useFairPriceCheck, usePriceTrend, useTodayPrices } from '@/hooks/usePrices';
import { getLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUser } from '@/store/auth';

const TREND_DAY_OPTIONS = [7, 30, 90] as const;

export default function PricesPage() {
  const { t } = useTranslation();
  const user = useUser();
  const language = getLanguage();

  const [district, setDistrict] = React.useState<string>(user?.district ?? TN_DISTRICTS[0]);
  const defaultCrop = user?.crops[0] ?? CROPS[0]!.key;
  const [trendCrop, setTrendCrop] = React.useState<string>(defaultCrop);
  const [trendDays, setTrendDays] = React.useState<number>(30);

  const today = useTodayPrices(district);
  const trend = usePriceTrend(district, trendCrop, trendDays);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('prices.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('prices.subtitle')}</p>
      </header>

      {today.data && today.data.crops.length > 0 && <PriceTicker crops={today.data.crops} />}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{t('prices.today.title')}</CardTitle>
          </div>
          <div className="w-44 shrink-0">
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger aria-label={t('prices.districtLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TN_DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {today.isLoading ? (
            <LoadingGrid />
          ) : today.data && today.data.crops.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {today.data.crops.map((crop) => (
                <div key={crop.cropKey} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{getCropName(crop.cropKey, language)}</span>
                    <Badge variant={crop.source === 'data_gov' ? 'info' : 'secondary'}>
                      {t(
                        crop.source === 'data_gov' ? 'prices.sourceGov' : 'prices.sourceGenerated',
                      )}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold">₹{crop.modalPrice}</span>
                    <span className="text-sm text-muted-foreground">{t('common.perKg')}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ₹{crop.minPrice} – ₹{crop.maxPrice}
                  </p>
                  {crop.changePercent !== undefined && crop.changePercent !== 0 && (
                    <p
                      className={cn(
                        'mt-2 flex items-center gap-1 text-xs font-medium',
                        crop.changePercent > 0 ? 'text-success' : 'text-danger',
                      )}
                    >
                      {crop.changePercent > 0 ? (
                        <TrendingUp className="size-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="size-3.5" aria-hidden="true" />
                      )}
                      {t(
                        crop.changePercent > 0
                          ? 'prices.today.changeUp'
                          : 'prices.today.changeDown',
                        { percent: crop.changePercent },
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('prices.today.empty')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle>{t('prices.trend.title')}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <Select value={trendCrop} onValueChange={setTrendCrop}>
                <SelectTrigger aria-label={t('prices.trend.cropLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CROPS.map((crop) => (
                    <SelectItem key={crop.key} value={crop.key}>
                      {getCropName(crop.key, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              className="inline-flex rounded-md border p-0.5"
              role="group"
              aria-label={t('prices.trend.daysLabel')}
            >
              {TREND_DAY_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTrendDays(days)}
                  aria-pressed={trendDays === days}
                  className={cn(
                    'rounded-[calc(var(--radius)-4px)] px-2.5 py-1 text-xs font-medium transition-colors',
                    trendDays === days
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {t(`prices.trend.days${days}`)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trend.isLoading ? (
            <div className="h-[200px] animate-pulse rounded-md bg-secondary" />
          ) : trend.data && trend.data.points.length >= 2 ? (
            <PriceTrendChart points={trend.data.points} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('prices.trend.empty')}</p>
          )}
        </CardContent>
      </Card>

      <FairPriceCheckerCard defaultDistrict={district} defaultCrop={trendCrop} />
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-lg border bg-secondary" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fair price checker
// ---------------------------------------------------------------------------

interface FairnessValues {
  district: string;
  crop: string;
  price: number;
}

function FairPriceCheckerCard({
  defaultDistrict,
  defaultCrop,
}: {
  defaultDistrict: string;
  defaultCrop: string;
}) {
  const { t } = useTranslation();
  const language = getLanguage();
  const check = useFairPriceCheck();
  const errorMessage = useApiErrorMessage();

  const form = useForm<FairnessValues>({
    resolver: zodResolver(fairPriceCheckSchema) as never,
    defaultValues: { district: defaultDistrict, crop: defaultCrop, price: 0 },
  });

  const onSubmit = form.handleSubmit((values) => {
    check.mutate(values);
  });

  const verdictVariant: Record<FairPriceVerdict, 'success' | 'warning' | 'info'> = {
    fair: 'success',
    below_market: 'warning',
    above_market: 'info',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('prices.fairness.title')}</CardTitle>
        <CardDescription>{t('prices.fairness.body')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FormError
          message={
            check.isError
              ? check.error.status === 404
                ? t('prices.fairness.notAvailable')
                : errorMessage(check.error)
              : undefined
          }
        />

        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]" noValidate>
          <FormField id="fairness-district" label={t('prices.districtLabel')}>
            <Select
              value={form.watch('district')}
              onValueChange={(value) => form.setValue('district', value, { shouldValidate: true })}
            >
              <SelectTrigger id="fairness-district">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TN_DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="fairness-crop" label={t('prices.fairness.cropLabel')}>
            <Select
              value={form.watch('crop')}
              onValueChange={(value) => form.setValue('crop', value, { shouldValidate: true })}
            >
              <SelectTrigger id="fairness-crop">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CROPS.map((crop) => (
                  <SelectItem key={crop.key} value={crop.key}>
                    {getCropName(crop.key, language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="fairness-price"
            label={t('prices.fairness.priceLabel')}
            error={form.formState.errors.price?.message}
          >
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              {...form.register('price', { valueAsNumber: true })}
            />
          </FormField>

          <div className="flex items-end">
            <Button type="submit" disabled={check.isPending} className="w-full sm:w-auto">
              {check.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {check.isPending ? t('prices.fairness.checking') : t('prices.fairness.submit')}
            </Button>
          </div>
        </form>

        {check.data && (
          <div className="rounded-lg border p-4">
            <Badge variant={verdictVariant[check.data.verdict]} className="text-sm">
              {t(`prices.fairness.verdict.${check.data.verdict}`)}
            </Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(`prices.fairness.verdictBody.${check.data.verdict}`, {
                percent: Math.abs(check.data.diffPercent),
                tolerance: FAIR_PRICE_TOLERANCE_PERCENT,
                modalPrice: check.data.modalPrice,
                district: check.data.district,
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
