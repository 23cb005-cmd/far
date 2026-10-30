/**
 * Indian mobile number handling.
 *
 * Canonical storage format is E.164: `+91XXXXXXXXXX` where the subscriber
 * number is 10 digits starting with 6-9. Users type numbers in many shapes
 * (`98765 43210`, `098765-43210`, `+91 98765 43210`, `0091...`), so we
 * normalise aggressively before validating.
 */

export const PHONE_E164_REGEX = /^\+91[6-9]\d{9}$/;

/** Strips everything that is not a digit or a leading plus. */
function stripFormatting(input: string): string {
  return input.trim().replace(/[\s()\-.]/g, '');
}

/**
 * Normalise a user-entered Indian mobile number to `+91XXXXXXXXXX`.
 * Returns null when the input cannot be a valid Indian mobile number.
 */
export function normalisePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;

  let value = stripFormatting(input);
  if (value === '') return null;

  // Drop the international dialling prefix.
  if (value.startsWith('+')) value = value.slice(1);

  // Strip any leading zeros. These are the domestic trunk prefix (`098765...`),
  // the `00` international prefix (`0091...`), or both (`0919876543210`). No
  // valid Indian mobile number begins with a zero, so this is unambiguous.
  value = value.replace(/^0+/, '');

  // Then the country code, if it is still present.
  if (value.length === 12 && value.startsWith('91')) value = value.slice(2);

  if (!/^\d{10}$/.test(value)) return null;
  // Indian mobile numbers start with 6-9; 1-5 are landline or service codes.
  if (!/^[6-9]/.test(value)) return null;

  return `+91${value}`;
}

export function isValidPhone(input: unknown): boolean {
  return normalisePhone(input) !== null;
}

/**
 * Mask a phone number for logs and for display to counterparties:
 * `+919876543210` -> `+91*****43210`.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '*'.repeat(digits.length);
  const last = digits.slice(-5);
  const prefix = phone.startsWith('+91') ? '+91' : '';
  return `${prefix}*****${last}`;
}

/** Local 10-digit form, for display in Indian contexts. */
export function toLocalPhone(phone: string): string {
  const normalised = normalisePhone(phone);
  return normalised ? normalised.slice(3) : phone;
}
