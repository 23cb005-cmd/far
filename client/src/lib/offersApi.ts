import type { OfferDto, Paginated } from '@farmfair/shared';
import { apiGet, apiPatch, apiPost } from './api';

export interface CreateOfferFormInput {
  quantityKg: number;
  offeredPricePerKg: number;
  message?: string;
}

/** One place for every offer endpoint, so URLs are not scattered across pages. */
export const offersApi = {
  create: (listingId: string, input: CreateOfferFormInput) =>
    apiPost<OfferDto>(`/listings/${listingId}/offers`, input),

  forListing: (listingId: string, page = 1, limit = 20) =>
    apiGet<Paginated<OfferDto>>(`/listings/${listingId}/offers`, { params: { page, limit } }),

  mine: (page = 1, limit = 20) =>
    apiGet<Paginated<OfferDto>>('/offers/mine', { params: { page, limit } }),

  withdraw: (id: string) => apiPatch<OfferDto>(`/offers/${id}/withdraw`),

  decline: (id: string, reason?: string) =>
    apiPatch<OfferDto>(`/offers/${id}/decline`, reason ? { reason } : {}),
};
