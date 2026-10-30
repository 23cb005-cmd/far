import { ERROR_CODES, type Role } from '@farmfair/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { User, type UserDocument } from '../models/User';
import { readAccessToken, verifyToken } from '../services/tokens';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Cache of the user document for the lifetime of a request, so guards that run
 * back to back (`requireAuth` then `requireVerifiedBuyer`) hit the database once.
 */
const CURRENT_USER = Symbol('currentUser');

interface RequestWithUser extends Request {
  [CURRENT_USER]?: UserDocument;
}

/**
 * Load the authenticated user, verifying that the token has not been revoked.
 *
 * `tokenVersion` is the revocation mechanism: logout, password change and
 * suspension all increment it on the user document, which immediately
 * invalidates every token issued before that point without needing a
 * deny-list.
 */
async function resolveUser(req: Request): Promise<UserDocument> {
  const cached = (req as RequestWithUser)[CURRENT_USER];
  if (cached) return cached;

  const token = readAccessToken(req);
  if (!token) throw AppError.unauthenticated('Sign in to continue');

  const claims = verifyToken('access', token);

  const user = await User.findById(claims.sub).exec();
  if (!user) throw AppError.unauthenticated('Sign in to continue');

  if (user.tokenVersion !== claims.tv) {
    throw AppError.unauthenticated('Your session has ended. Please sign in again.');
  }

  req.auth = { userId: String(user._id), role: user.role, tokenVersion: user.tokenVersion };
  (req as RequestWithUser)[CURRENT_USER] = user;
  return user;
}

/** Retrieve the user loaded by `requireAuth`. Throws if the guard did not run. */
export function currentUser(req: Request): UserDocument {
  const user = (req as RequestWithUser)[CURRENT_USER];
  if (!user) throw AppError.unauthenticated('Sign in to continue');
  return user;
}

export function currentUserOrNull(req: Request): UserDocument | undefined {
  return (req as RequestWithUser)[CURRENT_USER];
}

/** Rejects the request unless a valid, unrevoked access token is present. */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  await resolveUser(req);
  next();
});

/**
 * Populates `req.auth` when a valid token is present but never rejects.
 * Used by public endpoints that personalise their response for signed-in users.
 */
export const optionalAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  try {
    if (readAccessToken(req)) await resolveUser(req);
  } catch {
    // An invalid token on a public route is simply treated as anonymous.
  }
  next();
});

/** Restricts a route to the given roles. Must run after `requireAuth`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as RequestWithUser)[CURRENT_USER];
    if (!user) {
      next(AppError.unauthenticated('Sign in to continue'));
      return;
    }
    if (!roles.includes(user.role)) {
      next(AppError.forbidden('You do not have permission to do that'));
      return;
    }
    next();
  };
}

/**
 * Blocks suspended accounts from taking any action.
 *
 * Suspension also bumps `tokenVersion`, so existing sessions end immediately;
 * this guard covers the window where a suspended user signs in again.
 */
export const blockSuspended: RequestHandler = (req, _res, next) => {
  const user = (req as RequestWithUser)[CURRENT_USER];
  if (user?.isSuspended) {
    next(
      new AppError(
        403,
        ERROR_CODES.ACCOUNT_SUSPENDED,
        user.suspensionReason
          ? `Your account is suspended: ${user.suspensionReason}`
          : 'Your account is suspended. Contact support.',
      ),
    );
    return;
  }
  next();
};

/**
 * Requires an approved buyer. Pending buyers can browse the whole marketplace
 * but cannot make offers, so this guard is applied per route rather than
 * globally.
 */
export const requireVerifiedBuyer: RequestHandler = (req, _res, next) => {
  const user = (req as RequestWithUser)[CURRENT_USER];
  if (!user) {
    next(AppError.unauthenticated('Sign in to continue'));
    return;
  }
  if (user.role !== 'buyer') {
    next(AppError.forbidden('Only buyers can do that'));
    return;
  }
  if (user.verificationStatus !== 'approved') {
    next(
      new AppError(
        403,
        ERROR_CODES.BUYER_NOT_VERIFIED,
        user.verificationStatus === 'rejected'
          ? 'Your buyer account was not approved. Contact support.'
          : 'Your buyer account is awaiting verification. You can browse, but not make offers yet.',
      ),
    );
    return;
  }
  next();
};
