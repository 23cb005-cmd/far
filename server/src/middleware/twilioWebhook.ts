import type { NextFunction, Request, RequestHandler, Response } from 'express';
import Twilio from 'twilio';
import { env, isProduction } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';

/**
 * Verifies the `X-Twilio-Signature` header against the exact public URL this
 * request was posted to, so nobody else can forge an inbound WhatsApp
 * message. Twilio signs the full URL plus the form body with the account's
 * auth token; `validateRequest` recomputes that signature and compares.
 *
 * Without `TWILIO_AUTH_TOKEN` configured there is nothing to verify against.
 * Outside production that degrades to "accept anything" with a loud warning,
 * so local development (and the `/dev/bot` simulator) keep working without a
 * real Twilio account; production refuses to run unverified.
 */
export const verifyTwilioSignature: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!env.TWILIO_AUTH_TOKEN) {
    if (isProduction) {
      next(AppError.forbidden('Webhook signature verification is not configured'));
      return;
    }
    logger.warn(
      '[webhook] TWILIO_AUTH_TOKEN not set; skipping signature verification (development only)',
    );
    next();
    return;
  }

  const signature = req.header('X-Twilio-Signature');
  const base = env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get('host') ?? ''}`;
  const url = `${base}${req.originalUrl}`;

  const valid =
    Boolean(signature) &&
    Twilio.validateRequest(
      env.TWILIO_AUTH_TOKEN,
      signature!,
      url,
      req.body as Record<string, unknown>,
    );

  if (!valid) {
    next(AppError.forbidden('Invalid Twilio signature'));
    return;
  }
  next();
};
