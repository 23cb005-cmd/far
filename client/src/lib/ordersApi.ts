import type { OrderDto, Paginated, RatingDto } from '@farmfair/shared';
import { apiGet, apiPatch, apiPost } from './api';

export interface SubmitRatingInput {
  score: number;
  comment?: string;
}

/** One place for every order endpoint, so URLs are not scattered across pages. */
export const ordersApi = {
  mine: (page = 1, limit = 20) =>
    apiGet<Paginated<OrderDto>>('/orders/mine', { params: { page, limit } }),

  pay: (id: string) => apiPatch<OrderDto>(`/orders/${id}/pay`),

  confirm: (id: string) => apiPatch<OrderDto>(`/orders/${id}/confirm`),

  cancel: (id: string, reason?: string) =>
    apiPatch<OrderDto>(`/orders/${id}/cancel`, reason ? { reason } : {}),

  rate: (id: string, input: SubmitRatingInput) => apiPost<RatingDto>(`/orders/${id}/rating`, input),
};
