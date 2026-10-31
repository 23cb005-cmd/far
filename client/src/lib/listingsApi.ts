import type { ListingDto, Paginated } from '@farmfair/shared';
import { apiGet, apiPatch, apiPost } from './api';

export interface CreateListingFormInput {
  cropKey: string;
  grade: string;
  quantityKg: number;
  pricePerKg: number;
  /** `YYYY-MM-DD`, from a date input. */
  readyDate: string;
  photo?: File;
}

export interface ListingFilters {
  crop?: string;
  district?: string;
  grade?: string;
  page?: number;
  limit?: number;
}

function toFormData(input: CreateListingFormInput): FormData {
  const formData = new FormData();
  formData.append('cropKey', input.cropKey);
  formData.append('grade', input.grade);
  formData.append('quantityKg', String(input.quantityKg));
  formData.append('pricePerKg', String(input.pricePerKg));
  formData.append('readyDate', input.readyDate);
  if (input.photo) formData.append('photo', input.photo);
  return formData;
}

/** One place for every listing endpoint, so URLs are not scattered across pages. */
export const listingsApi = {
  create: (input: CreateListingFormInput) =>
    apiPost<ListingDto>('/listings', toFormData(input), {
      // The browser computes the multipart boundary; this only overrides the
      // client's default `application/json` so it does not get sent instead.
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  browse: (filters: ListingFilters) =>
    apiGet<Paginated<ListingDto>>('/listings', { params: filters }),

  mine: (page = 1, limit = 20) =>
    apiGet<Paginated<ListingDto>>('/listings/mine', { params: { page, limit } }),

  detail: (id: string) => apiGet<ListingDto>(`/listings/${id}`),

  withdraw: (id: string) => apiPatch<ListingDto>(`/listings/${id}/withdraw`),
};
