import type { OfferDto, Paginated } from '@farmfair/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiRequestError } from '@/lib/api';
import { offersApi, type CreateOfferFormInput } from '@/lib/offersApi';

export function useOffersForListing(listingId: string | undefined, page = 1, limit = 20) {
  return useQuery<Paginated<OfferDto>, ApiRequestError>({
    queryKey: ['offers', 'forListing', listingId, page, limit],
    queryFn: () => offersApi.forListing(listingId!, page, limit),
    enabled: Boolean(listingId),
  });
}

export function useMyOffers(page = 1, limit = 20) {
  return useQuery<Paginated<OfferDto>, ApiRequestError>({
    queryKey: ['offers', 'mine', page, limit],
    queryFn: () => offersApi.mine(page, limit),
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation<OfferDto, ApiRequestError, { listingId: string; input: CreateOfferFormInput }>(
    {
      mutationFn: ({ listingId, input }) => offersApi.create(listingId, input),
      onSuccess: (_offer, { listingId }) => {
        void queryClient.invalidateQueries({ queryKey: ['offers'] });
        void queryClient.invalidateQueries({ queryKey: ['listings', 'detail', listingId] });
      },
    },
  );
}

export function useWithdrawOffer() {
  const queryClient = useQueryClient();
  return useMutation<OfferDto, ApiRequestError, string>({
    mutationFn: (id) => offersApi.withdraw(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });
}

export function useDeclineOffer() {
  const queryClient = useQueryClient();
  return useMutation<OfferDto, ApiRequestError, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => offersApi.decline(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
      void queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] });
    },
  });
}
