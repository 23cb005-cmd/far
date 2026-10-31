import type {
  FairPriceCheckResponse,
  PriceTrendResponse,
  TodayPricesResponse,
} from '@farmfair/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ApiRequestError } from '@/lib/api';
import { pricesApi, type FairPriceCheckInput } from '@/lib/pricesApi';

export function useTodayPrices(district?: string) {
  return useQuery<TodayPricesResponse, ApiRequestError>({
    queryKey: ['prices', 'today', district ?? null],
    queryFn: () => pricesApi.today(district),
  });
}

export function usePriceTrend(district: string, crop: string, days = 30) {
  return useQuery<PriceTrendResponse, ApiRequestError>({
    queryKey: ['prices', 'trend', district, crop, days],
    queryFn: () => pricesApi.trend(district, crop, days),
    // district and crop always have a value once the page has mounted; this
    // only guards the first render before the defaults are known.
    enabled: Boolean(district && crop),
  });
}

export function useFairPriceCheck() {
  return useMutation<FairPriceCheckResponse, ApiRequestError, FairPriceCheckInput>({
    mutationFn: (input) => pricesApi.fairCheck(input),
  });
}
