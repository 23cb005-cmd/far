import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants';

export interface PasswordCheck {
  valid: boolean;
  /** Machine-readable reasons, suitable for i18n keys on the client. */
  problems: Array<'too_short' | 'too_long' | 'needs_letter' | 'needs_number'>;
}

/**
 * Password policy: 8-72 characters, at least one letter and one number.
 * Deliberately modest — farmers type these on feature-phone keyboards — and
 * paired with account lockout and rate limiting rather than complexity rules.
 */
export function checkPassword(password: string): PasswordCheck {
  const problems: PasswordCheck['problems'] = [];

  if (password.length < PASSWORD_MIN_LENGTH) problems.push('too_short');
  if (password.length > PASSWORD_MAX_LENGTH) problems.push('too_long');
  if (!/[A-Za-z]/.test(password)) problems.push('needs_letter');
  if (!/\d/.test(password)) problems.push('needs_number');

  return { valid: problems.length === 0, problems };
}

export function isValidPassword(password: string): boolean {
  return checkPassword(password).valid;
}

/** Rough strength hint for the UI meter. Not part of the policy. */
export function passwordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (!isValidPassword(password)) return 'weak';
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score >= 2) return 'strong';
  if (score === 1) return 'medium';
  return 'weak';
}
