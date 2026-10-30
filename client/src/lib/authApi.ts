import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  OtpSendResponse,
  RegisterInput,
  UpdateProfileInput,
  UserDto,
} from '@farmfair/shared';
import { apiGet, apiPatch, apiPost } from './api';

/** One place for every auth endpoint, so URLs are not scattered across pages. */
export const authApi = {
  csrf: () => apiGet<{ csrfToken: string }>('/auth/csrf'),

  register: async (input: RegisterInput): Promise<UserDto> => {
    const { user } = await apiPost<AuthResponse>('/auth/register', input);
    return user;
  },

  login: async (input: LoginInput): Promise<UserDto> => {
    const { user } = await apiPost<AuthResponse>('/auth/login', input);
    return user;
  },

  me: async (): Promise<UserDto> => {
    const { user } = await apiGet<AuthResponse>('/auth/me');
    return user;
  },

  updateMe: async (input: UpdateProfileInput): Promise<UserDto> => {
    const { user } = await apiPatch<AuthResponse>('/auth/me', input);
    return user;
  },

  changePassword: (input: ChangePasswordInput) =>
    apiPost<{ changed: boolean }>('/auth/change-password', input),

  logout: () => apiPost<{ loggedOut: boolean }>('/auth/logout'),

  refresh: async (): Promise<UserDto> => {
    const { user } = await apiPost<AuthResponse>('/auth/refresh');
    return user;
  },

  sendOtp: (phone?: string) => apiPost<OtpSendResponse>('/auth/otp/send', phone ? { phone } : {}),

  verifyOtp: async (code: string): Promise<UserDto> => {
    const { user } = await apiPost<AuthResponse>('/auth/otp/verify', { code });
    return user;
  },
};
