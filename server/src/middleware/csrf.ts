import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE, CSRF_HEADER, ERROR_CODES } from '@farmfair/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env, isProduction } from '../config/env';
import { AppError } from '../utils/AppError';

const TOKEN_BYTES = 32;

/**
 * Double-submit CSRF.
 *
 * `GET /auth/csrf` issues a random token in a *readable* cookie; the client
 * echoes it in the `X-CSRF-Token` header on every state-changing request. An
 * attacker on another origin can cause the cookie to be sent but cannot read
 * it to set the header, so the two cannot be made to match.
 *
 * This works alongside SameSite=strict session cookies as defence in depth:
 * either control alone would stop the common cases.
 */
export function issueCsrfToken(res: Response): string {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  res.cookie(CSRF_COOKIE, token, {
    // Readable by the client script - that is the whole point of double submit.
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 1000 * 60 * 60 * 12,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
  return token;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Rejects state-changing requests whose header and cookie tokens do not match. */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
  const headerToken = req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken || !constantTimeEquals(cookieToken, headerToken)) {
    next(
      new AppError(
        403,
        ERROR_CODES.CSRF_INVALID,
        'Missing or invalid CSRF token. Reload the page and try again.',
      ),
    );
    return;
  }

  next();
}

/**
 * Opt specific routes out of CSRF (third-party webhooks, which authenticate by
 * provider signature instead). Kept here so every exemption is visible in one
 * place.
 */
export function skipCsrf(paths: string[]): RequestHandler {
  return (req, res, next) => {
    if (paths.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }
    csrfProtection(req, res, next);
  };
}
