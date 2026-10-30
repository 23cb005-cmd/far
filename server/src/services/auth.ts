import {
  ACCOUNT_LOCK_MINUTES,
  ERROR_CODES,
  MAX_FAILED_LOGINS,
  type RegisterInput,
} from '@farmfair/shared';
import { User, type UserDocument } from '../models/User';
import { AppError } from '../utils/AppError';
import { hashPassword, needsRehash, verifyPassword } from './password';

export interface RegisterResult {
  user: UserDocument;
}

/**
 * Create a farmer or buyer account.
 *
 * The role is taken from the validated payload, which only permits `farmer` and
 * `buyer`; admins are created by the CLI. Buyers are forced to `pending`
 * verification by the model, not by the caller.
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);

  // Checking first gives a clean field-level error; the unique index remains
  // the real guarantee against a race between two concurrent registrations.
  const existing = await User.exists({ phone: input.phone });
  if (existing) {
    throw AppError.conflict('That phone number is already registered', ERROR_CODES.DUPLICATE_KEY, [
      { path: 'phone', message: 'Already registered' },
    ]);
  }

  const user = new User({
    name: input.name,
    phone: input.phone,
    passwordHash,
    role: input.role,
    district: input.district,
    village: input.village,
    crops: input.role === 'farmer' ? input.crops : [],
    language: input.language,
    ...(input.role === 'buyer' && input.business
      ? {
          business: {
            name: input.business.name,
            ...(input.business.gstNumber ? { gstNumber: input.business.gstNumber } : {}),
          },
        }
      : {}),
  });

  await user.save();
  return { user };
}

export interface LoginAttempt {
  phone: string;
  password: string;
}

/**
 * A real argon2 hash of a random string, computed once, used to equalise the
 * timing of "no such account" against "wrong password".
 */
let decoy: Promise<string> | null = null;
function decoyHash(): Promise<string> {
  decoy ??= hashPassword(`decoy-${Math.random()}`);
  return decoy;
}

/**
 * Authenticate by phone and password.
 *
 * Every failure path raises the same generic error so the response cannot be
 * used to enumerate registered phone numbers. The one exception is a locked
 * account, where telling the user to wait is more useful than leaving them
 * guessing - and by then the attacker already knows the account exists.
 */
export async function loginUser(attempt: LoginAttempt): Promise<UserDocument> {
  const user = await User.findOne({ phone: attempt.phone }).exec();

  if (!user) {
    // Burn a comparable amount of CPU so a missing account is not detectably
    // faster than a wrong password.
    await verifyPassword(await decoyHash(), attempt.password);
    throw AppError.invalidCredentials();
  }

  if (user.isLocked()) {
    const minutesLeft = Math.max(
      1,
      Math.ceil(((user.lockUntil as Date).getTime() - Date.now()) / 60000),
    );
    throw new AppError(
      423,
      ERROR_CODES.ACCOUNT_LOCKED,
      `Too many failed attempts. Try again in ${minutesLeft} minute(s).`,
    );
  }

  const valid = await verifyPassword(user.passwordHash, attempt.password);

  if (!valid) {
    await registerFailedAttempt(user);
    throw AppError.invalidCredentials();
  }

  if (user.isSuspended) {
    throw new AppError(
      403,
      ERROR_CODES.ACCOUNT_SUSPENDED,
      user.suspensionReason
        ? `Your account is suspended: ${user.suspensionReason}`
        : 'Your account is suspended. Contact support.',
    );
  }

  // Successful login clears the lockout counters and refreshes the hash if the
  // cost parameters have since been raised.
  const update: Record<string, unknown> = {
    $set: { failedLoginCount: 0, lastLoginAt: new Date() },
    $unset: { lockUntil: 1 },
  };

  if (needsRehash(user.passwordHash)) {
    (update.$set as Record<string, unknown>).passwordHash = await hashPassword(attempt.password);
  }

  await User.updateOne({ _id: user._id }, update).exec();

  user.failedLoginCount = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();

  return user;
}

/**
 * Count a failed attempt and lock the account once the threshold is reached.
 * Uses an atomic increment so parallel guesses cannot slip past the limit.
 */
async function registerFailedAttempt(user: UserDocument): Promise<void> {
  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { failedLoginCount: 1 } },
    { new: true, projection: { failedLoginCount: 1 } },
  ).exec();

  const count = updated?.failedLoginCount ?? user.failedLoginCount + 1;

  if (count >= MAX_FAILED_LOGINS) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          lockUntil: new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60 * 1000),
          failedLoginCount: 0,
        },
      },
    ).exec();
  }
}

/**
 * Change a password after verifying the current one, then revoke every
 * existing session by bumping `tokenVersion`.
 */
export async function changePassword(
  user: UserDocument,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new AppError(400, ERROR_CODES.INVALID_CREDENTIALS, 'Current password is incorrect', [
      { path: 'currentPassword', message: 'Incorrect password' },
    ]);
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
}

/** Revoke all sessions for a user (logout everywhere, suspension). */
export async function revokeSessions(user: UserDocument): Promise<number> {
  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { tokenVersion: 1 } },
    { new: true, projection: { tokenVersion: 1 } },
  ).exec();
  const version = updated?.tokenVersion ?? user.tokenVersion + 1;
  user.tokenVersion = version;
  return version;
}
