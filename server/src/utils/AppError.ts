import { ERROR_CODES, type ErrorCode } from '@farmfair/shared';

/**
 * The only error type route handlers should throw deliberately.
 *
 * `status` is the HTTP status, `code` a stable machine-readable string the
 * client maps to a translated message, and `details` optional structured
 * context (never anything secret - it is returned to the caller).
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /** Distinguishes deliberate errors from genuine bugs in the error handler. */
  readonly isOperational = true;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  // ---- common shapes, so call sites stay short and consistent -------------

  static badRequest(
    message: string,
    details?: unknown,
    code: string = ERROR_CODES.VALIDATION_ERROR,
  ) {
    return new AppError(400, code, message, details);
  }

  static unauthenticated(
    message = 'Authentication required',
    code: ErrorCode = ERROR_CODES.UNAUTHENTICATED,
  ) {
    return new AppError(401, code, message);
  }

  static invalidCredentials() {
    // Deliberately generic: do not reveal whether the phone exists.
    return new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid phone or password');
  }

  static forbidden(
    message = 'You do not have permission to do that',
    code: string = ERROR_CODES.FORBIDDEN,
  ) {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Not found') {
    return new AppError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message: string, code: string = ERROR_CODES.CONFLICT, details?: unknown) {
    return new AppError(409, code, message, details);
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new AppError(429, ERROR_CODES.RATE_LIMITED, message);
  }

  static internal(message = 'Something went wrong') {
    return new AppError(500, ERROR_CODES.INTERNAL_ERROR, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
