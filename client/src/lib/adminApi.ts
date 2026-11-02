import type {
  InboundMessageDto,
  JobName,
  JobRunDto,
  Paginated,
  Role,
  UserDto,
  VerificationStatus,
} from '@farmfair/shared';
import { apiGet, apiPatch, apiPost } from './api';

export interface AdminUsersFilters {
  page?: number;
  limit?: number;
  role?: Role;
  verificationStatus?: VerificationStatus;
  suspended?: boolean;
  search?: string;
}

/** One place for every admin endpoint, so URLs are not scattered across pages. */
export const adminApi = {
  users: (filters: AdminUsersFilters = {}) =>
    apiGet<Paginated<UserDto>>('/admin/users', { params: filters }),

  verifyBuyer: (id: string, status: 'approved' | 'rejected', note?: string) =>
    apiPatch<UserDto>(`/admin/users/${id}/verify`, { status, ...(note ? { note } : {}) }),

  suspendUser: (id: string, reason: string) =>
    apiPatch<UserDto>(`/admin/users/${id}/suspend`, { reason }),

  unsuspendUser: (id: string) => apiPatch<UserDto>(`/admin/users/${id}/unsuspend`),

  jobs: () => apiGet<{ items: JobRunDto[] }>('/admin/jobs'),

  runJob: (name: JobName) => apiPost<JobRunDto | undefined>(`/admin/jobs/${name}/run`),

  botMessages: (page = 1, limit = 20) =>
    apiGet<Paginated<InboundMessageDto>>('/admin/bot-messages', { params: { page, limit } }),
};
