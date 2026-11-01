import { randomInt } from 'node:crypto';
import type { Model } from 'mongoose';

/**
 * Short, human-typeable reference codes (e.g. "TK4P9Q") for the WhatsApp bot:
 * a farmer can read a Mongo ObjectId over chat, but cannot reliably retype
 * one. Excludes 0/O and 1/I, which are easy to confuse in a text message.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

export function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}

/**
 * A code unique within `model`'s `code` field. Collisions are astronomically
 * unlikely at 6 characters from a 32-character alphabet, but are checked for
 * and retried anyway rather than assumed away.
 */
export async function generateUniqueCode(model: Pick<Model<unknown>, 'exists'>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    if (!(await model.exists({ code }))) return code;
  }
  throw new Error('Could not generate a unique code after 5 attempts');
}
