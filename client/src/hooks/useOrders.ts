import type { OrderDto, Paginated, RatingDto } from '@farmfair/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiRequestError } from '@/lib/api';
import { ordersApi, type SubmitRatingInput } from '@/lib/ordersApi';

export function useMyOrders(page = 1, limit = 20) {
  return useQuery<Paginated<OrderDto>, ApiRequestError>({
    queryKey: ['orders', 'mine', page, limit],
    queryFn: () => ordersApi.mine(page, limit),
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();
  return useMutation<OrderDto, ApiRequestError, string>({
    mutationFn: (id) => ordersApi.pay(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useConfirmPickup() {
  const queryClient = useQueryClient();
  return useMutation<OrderDto, ApiRequestError, string>({
    mutationFn: (id) => ordersApi.confirm(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation<OrderDto, ApiRequestError, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => ordersApi.cancel(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useSubmitRating() {
  const queryClient = useQueryClient();
  return useMutation<RatingDto, ApiRequestError, { id: string; input: SubmitRatingInput }>({
    mutationFn: ({ id, input }) => ordersApi.rate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
