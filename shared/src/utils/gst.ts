/**
 * GSTIN validation.
 *
 * Format: 2-digit state code, 10-character PAN, 1 entity digit, 1 fixed 'Z',
 * 1 checksum character. Example: `33ABCDE1234F1Z5`.
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CHECKSUM_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Structural check only (shape, state code, checksum digit). */
export function isValidGstin(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const value = input.trim().toUpperCase();
  if (!GSTIN_REGEX.test(value)) return false;

  const stateCode = Number(value.slice(0, 2));
  if (stateCode < 1 || stateCode > 38) return false;

  return gstinChecksum(value.slice(0, 14)) === value[14];
}

/** Official GSTIN checksum: weighted mod-36 over the first 14 characters. */
function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < first14.length; i += 1) {
    const char = first14[i]!;
    const value = CHECKSUM_ALPHABET.indexOf(char);
    if (value < 0) return '';
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const remainder = sum % 36;
  const checkValue = (36 - remainder) % 36;
  return CHECKSUM_ALPHABET[checkValue] ?? '';
}

export function normaliseGstin(input: string): string {
  return input.trim().toUpperCase();
}
