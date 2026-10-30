import {
  ERROR_CODES,
  changePasswordSchema,
  loginSchema,
  otpSendSchema,
  otpVerifySchema,
  registerSchema,
  updateProfileSchema,
  type AuthResponse,
  type CsrfResponse,
  type OtpSendResponse,
  type UpdateProfileInput,
} from '@farmfair/shared';
import type { Request, Response } from 'express';
import { issueCsrfToken } from '../middleware/csrf';
import { currentUser } from '../middleware/auth';
import { User, toUserDto } from '../models/User';
import { changePassword, loginUser, registerUser, revokeSessions } from '../services/auth';
import { recordAudit } from '../services/audit';
import { sendOtp, verifyOtp } from '../services/otp';
import {
  clearAuthCookies,
  readRefreshToken,
  setAuthCookies,
  verifyToken,
} from '../services/tokens';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../utils/respond';

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

/**
 * GET /auth/csrf
 * Issues the double-submit token. Called by the client before its first
 * state-changing request and again whenever a request fails with CSRF_INVALID.
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  const csrfToken = issueCsrfToken(res);
  const body: CsrfResponse = { csrfToken };
  sendSuccess(res, body);
};

// ---------------------------------------------------------------------------
// Register / login / session
// ---------------------------------------------------------------------------

/** POST /auth/register */
export const register = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);

  const { user } = await registerUser(input);

  setAuthCookies(res, { sub: String(user._id), role: user.role, tv: user.tokenVersion });
  issueCsrfToken(res);

  await recordAudit({
    actor: user._id,
    action: 'auth.register',
    entity: 'User',
    entityId: String(user._id),
    metadata: { role: user.role, district: user.district, phone: user.phone },
    req,
  });

  const body: AuthResponse = { user: toUserDto(user) };
  sendCreated(res, body);
});

/** POST /auth/login */
export const login = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);

  try {
    const user = await loginUser(input);

    setAuthCookies(res, { sub: String(user._id), role: user.role, tv: user.tokenVersion });
    issueCsrfToken(res);

    await recordAudit({
      actor: user._id,
      action: 'auth.login.success',
      entity: 'User',
      entityId: String(user._id),
      metadata: { role: user.role },
      req,
    });

    const body: AuthResponse = { user: toUserDto(user) };
    sendSuccess(res, body);
  } catch (error) {
    // Audit the failure without revealing in the response whether the phone
    // exists. The audit trail intentionally records the (masked) phone so
    // repeated attacks on one number are visible to an admin.
    const locked = error instanceof AppError && error.code === ERROR_CODES.ACCOUNT_LOCKED;
    await recordAudit({
      action: locked ? 'auth.login.locked' : 'auth.login.failure',
      entity: 'User',
      metadata: {
        phone: input.phone,
        reason: error instanceof AppError ? error.code : 'unknown',
      },
      req,
    });
    throw error;
  }
});

/**
 * POST /auth/refresh
 * Rotates both tokens. A token whose `tokenVersion` no longer matches the user
 * has been revoked (logout, password change, suspension) and is rejected.
 */
export const refresh = asyncHandler(async (req, res) => {
  const token = readRefreshToken(req);
  if (!token) {
    throw AppError.unauthenticated('No session to refresh', ERROR_CODES.UNAUTHENTICATED);
  }

  const claims = verifyToken('refresh', token);

  const user = await User.findById(claims.sub).exec();
  if (!user || user.tokenVersion !== claims.tv) {
    clearAuthCookies(res);
    throw AppError.unauthenticated('Your session has ended. Please sign in again.');
  }

  if (user.isSuspended) {
    clearAuthCookies(res);
    throw new AppError(403, ERROR_CODES.ACCOUNT_SUSPENDED, 'Your account is suspended.');
  }

  setAuthCookies(res, { sub: String(user._id), role: user.role, tv: user.tokenVersion });
  issueCsrfToken(res);

  const body: AuthResponse = { user: toUserDto(user) };
  sendSuccess(res, body);
});

/**
 * POST /auth/logout
 * Clears the cookies and bumps `tokenVersion`, which invalidates every token
 * already issued - including any copy an attacker may have captured.
 */
export const logout = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  await revokeSessions(user);
  clearAuthCookies(res);

  await recordAudit({
    actor: user._id,
    action: 'auth.logout',
    entity: 'User',
    entityId: String(user._id),
    req,
  });

  sendSuccess(res, { loggedOut: true });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** GET /auth/me */
export const getMe = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const body: AuthResponse = { user: toUserDto(user) };
  sendSuccess(res, body);
});

/** PATCH /auth/me */
export const updateMe = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input: UpdateProfileInput = updateProfileSchema.parse(req.body);

  const changed: string[] = [];

  if (input.name !== undefined && input.name !== user.name) {
    user.name = input.name;
    changed.push('name');
  }
  if (input.district !== undefined && input.district !== user.district) {
    user.district = input.district;
    changed.push('district');
  }
  if (input.village !== undefined && input.village !== user.village) {
    user.village = input.village;
    changed.push('village');
  }
  if (input.crops !== undefined) {
    // Only farmers track crops; for buyers this is the alert subscription list.
    user.crops = input.crops;
    changed.push('crops');
  }
  if (input.language !== undefined && input.language !== user.language) {
    user.language = input.language;
    changed.push('language');
  }
  if (input.notifyWhatsApp !== undefined && input.notifyWhatsApp !== user.notifyWhatsApp) {
    user.notifyWhatsApp = input.notifyWhatsApp;
    changed.push('notifyWhatsApp');
  }
  if (input.business) {
    if (user.role !== 'buyer') {
      throw AppError.badRequest('Only buyers have business details');
    }
    user.business = {
      name: input.business.name ?? user.business?.name,
      ...(input.business.gstNumber !== undefined
        ? { gstNumber: input.business.gstNumber }
        : user.business?.gstNumber
          ? { gstNumber: user.business.gstNumber }
          : {}),
    };
    changed.push('business');
  }

  await user.save();

  await recordAudit({
    actor: user._id,
    action: 'auth.profile.update',
    entity: 'User',
    entityId: String(user._id),
    metadata: { fields: changed },
    req,
  });

  const body: AuthResponse = { user: toUserDto(user) };
  sendSuccess(res, body);
});

/**
 * POST /auth/change-password
 * Revokes all sessions, then issues a fresh pair so the caller stays signed in
 * on this device only.
 */
export const changeMyPassword = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = changePasswordSchema.parse(req.body);

  await changePassword(user, input.currentPassword, input.newPassword);

  setAuthCookies(res, { sub: String(user._id), role: user.role, tv: user.tokenVersion });
  issueCsrfToken(res);

  await recordAudit({
    actor: user._id,
    action: 'auth.password.change',
    entity: 'User',
    entityId: String(user._id),
    req,
  });

  sendSuccess(res, { changed: true });
});

// ---------------------------------------------------------------------------
// OTP phone verification
// ---------------------------------------------------------------------------

/** POST /auth/otp/send */
export const sendOtpCode = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = otpSendSchema.parse(req.body ?? {});

  if (input.phone && input.phone !== user.phone) {
    const taken = await User.exists({ phone: input.phone, _id: { $ne: user._id } });
    if (taken) {
      throw AppError.conflict('That phone number is already registered', ERROR_CODES.DUPLICATE_KEY);
    }
  }

  const result = await sendOtp(user, input.phone);

  await recordAudit({
    actor: user._id,
    action: 'auth.otp.send',
    entity: 'User',
    entityId: String(user._id),
    metadata: { phone: input.phone ?? user.phone },
    req,
  });

  const body: OtpSendResponse = {
    sent: true,
    expiresAt: result.expiresAt.toISOString(),
    ...(result.devCode ? { devCode: result.devCode } : {}),
  };
  sendSuccess(res, body);
});

/** POST /auth/otp/verify */
export const verifyOtpCode = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = otpVerifySchema.parse(req.body);

  await verifyOtp(user, input.code);

  await recordAudit({
    actor: user._id,
    action: 'auth.otp.verify',
    entity: 'User',
    entityId: String(user._id),
    req,
  });

  const body: AuthResponse = { user: toUserDto(user) };
  sendSuccess(res, body);
});
