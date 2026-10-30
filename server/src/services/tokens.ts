import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL,
  ERROR_CODES,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL,
  type Role,
} from '@farmfair/shared';
import type { CookieOptions, Request, Response } from 'express';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env, isProduction } from '../config/env';
import { AppError } from '../utils/AppError';

export interface TokenClaims {
  /** User id. */
  sub: string;
  role: Role;
  /** Must match the user document, so logout/password change revokes tokens. */
  tv: number;
}

export type TokenKind = 'access' | 'refresh';

const ISSUER = 'farmfair';
const AUDIENCE = 'farmfair-client';

function secretFor(kind: TokenKind): string {
  return kind === 'access' ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
}

function ttlFor(kind: TokenKind): string {
  return kind === 'access' ? ACCESS_TOKEN_TTL : REFRESH_TOKEN_TTL;
}

export function signToken(kind: TokenKind, claims: TokenClaims): string {
  const options: SignOptions = {
    expiresIn: ttlFor(kind) as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: claims.sub,
  };
  return jwt.sign({ role: claims.role, tv: claims.tv }, secretFor(kind), options);
}

/**
 * Verify a token and return its claims.
 *
 * Distinguishes expiry from tampering so the client can decide whether to
 * attempt a refresh, but neither case reveals anything about the user.
 */
export function verifyToken(kind: TokenKind, token: string): TokenClaims {
  try {
    const payload = jwt.verify(token, secretFor(kind), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    }) as JwtPayload;

    if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number') {
      throw new AppError(401, ERROR_CODES.TOKEN_INVALID, 'Malformed session token');
    }

    return { sub: payload.sub, role: payload.role as Role, tv: payload.tv };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Session expired');
    }
    throw new AppError(401, ERROR_CODES.TOKEN_INVALID, 'Invalid session token');
  }
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(kind: TokenKind): CookieOptions {
  return {
    httpOnly: true,
    // Secure cookies would never be sent over plain-HTTP localhost in dev.
    secure: isProduction,
    sameSite: 'strict',
    // The refresh cookie is scoped to the auth routes, so it is not attached to
    // ordinary API calls and has a much smaller exposure surface.
    path: kind === 'refresh' ? REFRESH_COOKIE_PATH : '/',
    maxAge: kind === 'refresh' ? SEVEN_DAYS : FIFTEEN_MINUTES,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookies(res: Response, claims: TokenClaims): void {
  res.cookie(ACCESS_COOKIE, signToken('access', claims), cookieOptions('access'));
  res.cookie(REFRESH_COOKIE, signToken('refresh', claims), cookieOptions('refresh'));
}

export function clearAuthCookies(res: Response): void {
  const access = cookieOptions('access');
  const refresh = cookieOptions('refresh');
  // maxAge must be dropped for a clearing cookie to be accepted.
  delete access.maxAge;
  delete refresh.maxAge;
  res.clearCookie(ACCESS_COOKIE, access);
  res.clearCookie(REFRESH_COOKIE, refresh);
}

export function readAccessToken(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  const fromCookie = cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;

  // Bearer tokens are accepted so the Swagger UI and curl are usable in dev.
  const header = req.header('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();

  return undefined;
}

export function readRefreshToken(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[REFRESH_COOKIE];
}
