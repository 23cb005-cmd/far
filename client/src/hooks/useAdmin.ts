import type { InboundMessageDto, JobName, JobRunDto, Paginated, UserDto } from '@farmfair/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiRequestError } from '@/lib/api';
import { adminApi, type AdminUsersFilters } from '@/lib/adminApi';

export function useAdminUsers(filters: AdminUsersFilters = {}) {
  return useQuery<Paginated<UserDto>, ApiRequestError>({
    queryKey: ['admin', 'users', filters],
    queryFn: () => adminApi.users(filters),
  });
}

export function useVerifyBuyer() {
  const queryClient = useQueryClient();
  return useMutation<
    UserDto,
    ApiRequestError,
    { id: string; status: 'approved' | 'rejected'; note?: string }
  >({
    mutationFn: ({ id, status, note }) => adminApi.verifyBuyer(id, status, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation<UserDto, ApiRequestError, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => adminApi.suspendUser(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUnsuspendUser() {
  const queryClient = useQueryClient();
  return useMutation<UserDto, ApiRequestError, string>({
    mutationFn: (id) => adminApi.unsuspendUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useAdminJobs() {
  return useQuery<{ items: JobRunDto[] }, ApiRequestError>({
    queryKey: ['admin', 'jobs'],
    queryFn: () => adminApi.jobs(),
  });
}

export function useRunJob() {
  const queryClient = useQueryClient();
  return useMutation<JobRunDto | undefined, ApiRequestError, JobName>({
    mutationFn: (name) => adminApi.runJob(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
  });
}

export function useAdminBotMessages(page = 1, limit = 20) {
  return useQuery<Paginated<InboundMessageDto>, ApiRequestError>({
    queryKey: ['admin', 'botMessages', page, limit],
    queryFn: () => adminApi.botMessages(page, limit),
  });
}
