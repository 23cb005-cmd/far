import { ERROR_CODES, normalisePhone } from '@farmfair/shared';
import type { Request, Response } from 'express';
import rateLimit, { type Options } from 'express-rate-limit';
import { env, isTest } from '../config/env';
import { sendError } from '../utils/respond';

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

function limitHandler(_req: Request, res: Response): void {
  sendError(
    res,
    429,
    ERROR_CODES.RATE_LIMITED,
    'Too many requests. Please wait a few minutes and try again.',
  );
}

function base(max: number, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitHandler,
    // Tests exercise the limiter explicitly where it matters; leaving it on
    // globally would make unrelated suites flaky.
    skip: () => isTest && process.env.RATE_LIMIT_IN_TESTS !== 'true',
    ...extra,
  });
}

/** Whole-API budget: 300 requests / 15 min per IP by default. */
export const generalLimiter = base(env.RATE_LIMIT_GENERAL_MAX);

/** Auth routes: 10 requests / 15 min per IP by default. */
export const authLimiter = base(env.RATE_LIMIT_AUTH_MAX, {
  // Only failures should consume the budget for reads like /auth/me.
  skipSuccessfulRequests: false,
});

/**
 * OTP sends: 3 / 15 min keyed on the *phone*, not the IP, so one person cannot
 * burn through a village-shared connection and so an attacker cannot spam a
 * single number from many addresses.
 */
export const otpLimiter = base(env.RATE_LIMIT_OTP_MAX, {
  keyGenerator: (req: Request): string => {
    const fromBody =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as { phone?: unknown }).phone
        : undefined;
    const phone = normalisePhone(fromBody);
    if (phone) return `otp:${phone}`;
    if (req.auth?.userId) return `otp:user:${req.auth.userId}`;
    return `otp:ip:${req.ip ?? 'unknown'}`;
  },
});
