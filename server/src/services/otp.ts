import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  ERROR_CODES,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  type Language,
} from '@farmfair/shared';
import { OtpCode, type OtpCodeDocument } from '../models/OtpCode';
import type { UserDocument } from '../models/User';
import { getOtpProvider } from '../providers/otp';
import { AppError } from '../utils/AppError';

/** Codes are stored hashed so a database dump does not reveal live codes. */
function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  const max = 10 ** OTP_LENGTH;
  // randomInt is CSPRNG-backed; padStart keeps leading zeros meaningful.
  return String(randomInt(0, max)).padStart(OTP_LENGTH, '0');
}

function hashesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export interface SendOtpResult {
  expiresAt: Date;
  devCode?: string;
}

/**
 * Issue a new code for the user's phone.
 *
 * Any outstanding codes are consumed first, so only the most recent code is
 * ever valid and an attacker cannot work through a backlog of guesses.
 */
export async function sendOtp(user: UserDocument, phone?: string): Promise<SendOtpResult> {
  const destination = phone ?? user.phone;

  await OtpCode.updateMany(
    { user: user._id, purpose: 'phone_verification', consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } },
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OtpCode.create({
    user: user._id,
    phone: destination,
    codeHash: hashCode(code),
    purpose: 'phone_verification',
    expiresAt,
  });

  const provider = getOtpProvider();
  const result = await provider.send({
    to: destination,
    code,
    expiresInMinutes: OTP_TTL_MINUTES,
    language: user.language as Language,
  });

  if (!result.delivered) {
    throw AppError.internal('Could not send the verification code. Please try again.');
  }

  return {
    expiresAt,
    // Only development providers may hand the code back.
    ...(provider.exposesCode && result.devCode ? { devCode: result.devCode } : {}),
  };
}

/**
 * Check a submitted code.
 *
 * Attempts are counted on the stored document, so the limit holds across
 * processes and survives a restart. Exhausting the attempts burns the code.
 */
export async function verifyOtp(user: UserDocument, code: string): Promise<void> {
  const record: OtpCodeDocument | null = await OtpCode.findOne({
    user: user._id,
    purpose: 'phone_verification',
    consumedAt: { $exists: false },
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!record) {
    throw new AppError(
      400,
      ERROR_CODES.OTP_EXPIRED,
      'No active verification code. Request a new one.',
    );
  }

  if (record.isExpired()) {
    record.consumedAt = new Date();
    await record.save();
    throw new AppError(400, ERROR_CODES.OTP_EXPIRED, 'That code has expired. Request a new one.');
  }

  if (record.isExhausted()) {
    record.consumedAt = new Date();
    await record.save();
    throw new AppError(
      429,
      ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
      'Too many incorrect attempts. Request a new code.',
    );
  }

  if (!hashesMatch(record.codeHash, hashCode(code))) {
    record.attempts += 1;
    const exhausted = record.attempts >= OTP_MAX_ATTEMPTS;
    if (exhausted) record.consumedAt = new Date();
    await record.save();

    throw new AppError(
      400,
      exhausted ? ERROR_CODES.OTP_ATTEMPTS_EXCEEDED : ERROR_CODES.OTP_INVALID,
      exhausted
        ? 'Too many incorrect attempts. Request a new code.'
        : `Incorrect code. ${OTP_MAX_ATTEMPTS - record.attempts} attempt(s) left.`,
    );
  }

  record.consumedAt = new Date();
  await record.save();

  user.phoneVerified = true;
  if (record.phone !== user.phone) {
    // Verifying a different number is how a user changes their phone.
    user.phone = record.phone;
  }
  await user.save();
}

/** Exposed for tests. */
export const __testing = { hashCode, generateCode };
