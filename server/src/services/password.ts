import argon2 from 'argon2';
import { logger } from '../config/logger';

/**
 * argon2id parameters.
 *
 * Tuned for a small cloud instance: ~19 MiB of memory and two passes keeps a
 * single hash near 50-100 ms, which is slow enough to make offline cracking
 * expensive without starving a 512 MB container under a login burst. These are
 * the OWASP-recommended minimums for argon2id.
 */
const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

/**
 * Verify a password against a stored hash. Returns false rather than throwing
 * on a malformed hash, so one corrupt record cannot produce a 500 on login.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    logger.error({ err: (error as Error).message }, 'Password verification failed');
    return false;
  }
}

/** True when the stored hash was produced with weaker parameters than current. */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, OPTIONS);
  } catch {
    return false;
  }
}
