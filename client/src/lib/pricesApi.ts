import type {
  FairPriceCheckResponse,
  PriceTrendResponse,
  TodayPricesResponse,
} from '@farmfair/shared';
import { apiGet, apiPost } from './api';

export interface FairPriceCheckInput {
  district: string;
  crop: string;
  price: number;
}

/** One place for every mandi-price endpoint, so URLs are not scattered across pages. */
export const pricesApi = {
  today: (district?: string) =>
    apiGet<TodayPricesResponse>('/prices/today', { params: district ? { district } : undefined }),

  trend: (district: string, crop: string, days?: number) =>
    apiGet<PriceTrendResponse>('/prices/trend', { params: { district, crop, days } }),

  fairCheck: (input: FairPriceCheckInput) =>
    apiPost<FairPriceCheckResponse>('/prices/fair-check', input),
};
