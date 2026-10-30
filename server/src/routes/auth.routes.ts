import {
  changePasswordSchema,
  loginSchema,
  otpSendSchema,
  otpVerifySchema,
  registerSchema,
  updateProfileSchema,
} from '@farmfair/shared';
import { Router } from 'express';
import {
  changeMyPassword,
  getCsrfToken,
  getMe,
  login,
  logout,
  refresh,
  register,
  sendOtpCode,
  updateMe,
  verifyOtpCode,
} from '../controllers/auth.controller';
import { blockSuspended, requireAuth } from '../middleware/auth';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';

export const authRouter = Router();

/**
 * Route order matters: the auth rate limiter is attached per route rather than
 * to the whole router so that `GET /csrf` and `GET /me` - which the client
 * polls - do not consume the login budget.
 */

authRouter.get('/csrf', getCsrfToken);

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), login);
authRouter.post('/refresh', authLimiter, refresh);
authRouter.post('/logout', requireAuth, logout);

authRouter.get('/me', requireAuth, getMe);
authRouter.patch(
  '/me',
  requireAuth,
  blockSuspended,
  validate({ body: updateProfileSchema }),
  updateMe,
);
authRouter.post(
  '/change-password',
  authLimiter,
  requireAuth,
  blockSuspended,
  validate({ body: changePasswordSchema }),
  changeMyPassword,
);

authRouter.post(
  '/otp/send',
  requireAuth,
  blockSuspended,
  validate({ body: otpSendSchema }),
  // Keyed on the phone, so this must run after the body has been parsed.
  otpLimiter,
  sendOtpCode,
);
authRouter.post(
  '/otp/verify',
  requireAuth,
  blockSuspended,
  validate({ body: otpVerifySchema }),
  verifyOtpCode,
);
