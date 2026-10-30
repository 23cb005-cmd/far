import { API_PREFIX, CSRF_COOKIE, CSRF_HEADER, type ApiResponse } from '@farmfair/shared';
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

/**
 * A typed error carrying the server's machine-readable code, so callers can
 * branch on `code` instead of parsing messages.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level issues from a 400, shaped for react-hook-form. */
  get fieldErrors(): Array<{ path: string; message: string }> {
    if (!Array.isArray(this.details)) return [];
    return (this.details as Array<{ path?: unknown; message?: unknown }>)
      .filter((d) => typeof d.path === 'string' && typeof d.message === 'string')
      .map((d) => ({ path: d.path as string, message: d.message as string }));
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
  return match ? decodeURIComponent(match[1] ?? '') : undefined;
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export const api: AxiosInstance = axios.create({
  // Relative, so the Vite dev proxy and the production rewrite both work and
  // the browser stays on one origin for SameSite=strict cookies.
  baseURL: import.meta.env.VITE_API_URL ?? API_PREFIX,
  // Session cookies are httpOnly; the browser must be told to send them.
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/** Ensure a CSRF token exists, fetching one if this is the first mutation. */
async function ensureCsrfToken(): Promise<string | undefined> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  try {
    await axios.get(`${API_PREFIX}/auth/csrf`, { withCredentials: true });
    return readCookie(CSRF_COOKIE);
  } catch {
    return undefined;
  }
}

// ---- request: attach the CSRF token to every state-changing call ----
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    if (token) config.headers.set(CSRF_HEADER, token);
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response: refresh once on 401, then retry; otherwise send the user to login
// ---------------------------------------------------------------------------

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/** Hook the app sets so an expired session can clear state and redirect. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/**
 * Concurrent 401s must not each fire their own refresh: the first one does the
 * work and the rest await the same promise.
 */
let refreshing: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  refreshing ??= (async () => {
    try {
      const token = await ensureCsrfToken();
      await axios.post(`${API_PREFIX}/auth/refresh`, null, {
        withCredentials: true,
        headers: token ? { [CSRF_HEADER]: token } : undefined,
      });
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Endpoints where a 401 is the expected answer, not a signal to refresh. */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function toApiError(error: AxiosError<ApiResponse>): ApiRequestError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data;

  if (body?.error) {
    return new ApiRequestError(status, body.error.code, body.error.message, body.error.details);
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiRequestError(0, 'TIMEOUT', 'The request timed out. Check your connection.');
  }
  if (!error.response) {
    return new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection.',
    );
  }
  return new ApiRequestError(status, 'UNKNOWN_ERROR', error.message || 'Something went wrong');
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';

    const refreshable =
      status === 401 &&
      config &&
      !config._retried &&
      !NO_REFRESH_PATHS.some((path) => url.includes(path));

    if (refreshable) {
      config._retried = true;
      try {
        await refreshSession();
        return await api.request(config);
      } catch {
        // The refresh itself failed: the session is genuinely over.
        onSessionExpired?.();
        throw toApiError(error);
      }
    }

    if (status === 401 && !NO_REFRESH_PATHS.some((path) => url.includes(path))) {
      onSessionExpired?.();
    }

    throw toApiError(error);
  },
);

// ---------------------------------------------------------------------------
// Typed helpers: unwrap the { success, data } envelope
// ---------------------------------------------------------------------------

function unwrap<T>(body: ApiResponse<T>): T {
  if (!body.success || body.data === undefined) {
    throw new ApiRequestError(
      500,
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? 'Unexpected response from the server',
      body.error?.details,
    );
  }
  return body.data;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<ApiResponse<T>>(url, config);
  return unwrap(res.data);
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await api.post<ApiResponse<T>>(url, body ?? null, config);
  return unwrap(res.data);
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await api.patch<ApiResponse<T>>(url, body ?? null, config);
  return unwrap(res.data);
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.delete<ApiResponse<T>>(url, config);
  return unwrap(res.data);
}
