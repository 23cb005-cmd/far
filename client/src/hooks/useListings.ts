import type { ListingDto, Paginated } from '@farmfair/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiRequestError } from '@/lib/api';
import { listingsApi, type CreateListingFormInput, type ListingFilters } from '@/lib/listingsApi';

export function useBrowseListings(filters: ListingFilters) {
  return useQuery<Paginated<ListingDto>, ApiRequestError>({
    queryKey: ['listings', 'browse', filters],
    queryFn: () => listingsApi.browse(filters),
  });
}

export function useMyListings(page = 1, limit = 20) {
  return useQuery<Paginated<ListingDto>, ApiRequestError>({
    queryKey: ['listings', 'mine', page, limit],
    queryFn: () => listingsApi.mine(page, limit),
  });
}

export function useListingDetail(id: string | undefined) {
  return useQuery<ListingDto, ApiRequestError>({
    queryKey: ['listings', 'detail', id],
    queryFn: () => listingsApi.detail(id!),
    enabled: Boolean(id),
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  return useMutation<ListingDto, ApiRequestError, CreateListingFormInput>({
    mutationFn: (input) => listingsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useWithdrawListing() {
  const queryClient = useQueryClient();
  return useMutation<ListingDto, ApiRequestError, string>({
    mutationFn: (id) => listingsApi.withdraw(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}
