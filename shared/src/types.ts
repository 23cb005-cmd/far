import type { Grade, Language, Role, VerificationStatus } from './constants';

// ---------------------------------------------------------------------------
// Transport envelope
//
// Every API response — success or failure — uses this shape, so the client can
// narrow on `success` without guessing.
// ---------------------------------------------------------------------------

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export type ApiSuccess<T> = ApiResponse<T> & { success: true; data: T };
export type ApiFailure = ApiResponse<never> & { success: false; error: ApiError };

export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccess<T> {
  return res.success === true && res.data !== undefined;
}

/** Field-level validation problems, as produced from a Zod error. */
export interface FieldIssue {
  path: string;
  message: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

// ---------------------------------------------------------------------------
// Domain DTOs
// ---------------------------------------------------------------------------

export interface BusinessInfo {
  name?: string;
  gstNumber?: string;
}

/** The user object returned to its owner. Never contains secrets. */
export interface UserDto {
  id: string;
  name: string;
  phone: string;
  role: Role;
  district: string;
  village?: string;
  crops: string[];
  language: Language;
  business?: BusinessInfo;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  isSuspended: boolean;
  notifyWhatsApp: boolean;
  phoneVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** The reduced view other users may see. */
export interface PublicUserDto {
  id: string;
  name: string;
  role: Role;
  district: string;
  village?: string;
  businessName?: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  memberSince: string;
}

export interface AuthResponse {
  user: UserDto;
}

export interface CsrfResponse {
  csrfToken: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  environment: string;
  db: {
    status: 'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'uninitialized';
    name?: string;
  };
  timestamp: string;
}

export interface OtpSendResponse {
  sent: boolean;
  expiresAt: string;
  /** Present only when the console provider is active (development). */
  devCode?: string;
}

// ---------------------------------------------------------------------------
// Shared error codes (kept in one place so client copy can map to them)
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_KEY: 'DUPLICATE_KEY',
  CSRF_INVALID: 'CSRF_INVALID',
  RATE_LIMITED: 'RATE_LIMITED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  BUYER_NOT_VERIFIED: 'BUYER_NOT_VERIFIED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// Re-export commonly paired types for convenience.
export type { Grade, Language, Role, VerificationStatus };
