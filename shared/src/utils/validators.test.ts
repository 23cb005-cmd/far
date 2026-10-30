import { describe, expect, it } from 'vitest';
import { isValidPhone, maskPhone, normalisePhone, toLocalPhone } from './phone';
import { checkPassword, isValidPassword, passwordStrength } from './password';
import { isValidGstin, normaliseGstin } from './gst';

describe('normalisePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['98765-43210', '+919876543210'],
    ['098765 43210', '+919876543210'],
    ['0919876543210', '+919876543210'],
    ['00919876543210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['(98765) 43210', '+919876543210'],
    ['  9876543210  ', '+919876543210'],
    ['6123456789', '+916123456789'],
  ])('normalises %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([
    ['5876543210', 'leading digit below 6'],
    ['1234567890', 'leading digit below 6'],
    ['987654321', 'too short'],
    ['98765432101', 'too long'],
    ['', 'empty'],
    ['abcdefghij', 'not digits'],
    ['+1 415 555 0123', 'not an Indian number'],
  ])('rejects %s (%s)', (input) => {
    expect(normalisePhone(input)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(normalisePhone(undefined)).toBeNull();
    expect(normalisePhone(9876543210)).toBeNull();
    expect(normalisePhone(null)).toBeNull();
  });

  it('exposes a boolean helper', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('maskPhone', () => {
  it('keeps only the last five digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91*****43210');
  });

  it('handles empty and short values without throwing', () => {
    expect(maskPhone(undefined)).toBe('');
    expect(maskPhone('')).toBe('');
    expect(maskPhone('123')).toBe('***');
  });

  it('never contains the middle digits', () => {
    expect(maskPhone('+919876543210')).not.toContain('98765');
  });
});

describe('toLocalPhone', () => {
  it('strips the country code', () => {
    expect(toLocalPhone('+919876543210')).toBe('9876543210');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(toLocalPhone('not-a-phone')).toBe('not-a-phone');
  });
});

describe('checkPassword', () => {
  it('accepts a compliant password', () => {
    expect(checkPassword('farmfair1')).toEqual({ valid: true, problems: [] });
  });

  it('flags a short password', () => {
    expect(checkPassword('ab1')).toMatchObject({ valid: false });
    expect(checkPassword('ab1').problems).toContain('too_short');
  });

  it('flags a password longer than 72 characters', () => {
    const problems = checkPassword(`${'a'.repeat(72)}1`).problems;
    expect(problems).toContain('too_long');
  });

  it('requires a letter and a number', () => {
    expect(checkPassword('12345678').problems).toContain('needs_letter');
    expect(checkPassword('abcdefgh').problems).toContain('needs_number');
  });

  it('accepts exactly 8 and exactly 72 characters', () => {
    expect(isValidPassword('abcdefg1')).toBe(true);
    expect(isValidPassword(`${'a'.repeat(71)}1`)).toBe(true);
  });
});

describe('passwordStrength', () => {
  it('rates non-compliant passwords weak', () => {
    expect(passwordStrength('short')).toBe('weak');
  });

  it('rewards length, mixed case and symbols', () => {
    expect(passwordStrength('abcdefg1')).toBe('weak');
    expect(passwordStrength('Abcdefg1')).toBe('medium');
    expect(passwordStrength('Abcdefghij1!')).toBe('strong');
  });
});

describe('isValidGstin', () => {
  it('accepts a structurally valid Tamil Nadu GSTIN', () => {
    // 33 = Tamil Nadu; checksum character computed with the official algorithm.
    expect(isValidGstin('33ASDFG1234H1ZX')).toBe(true);
  });

  it('rejects a wrong checksum character', () => {
    expect(isValidGstin('33ASDFG1234H1Z9')).toBe(false);
  });

  it('rejects malformed values', () => {
    expect(isValidGstin('')).toBe(false);
    expect(isValidGstin('33ASDFG1234H1Z')).toBe(false);
    expect(isValidGstin('99ASDFG1234H1Z4')).toBe(false);
    expect(isValidGstin(12345)).toBe(false);
  });

  it('normalises case and whitespace', () => {
    expect(normaliseGstin(' 33asdfg1234h1zx ')).toBe('33ASDFG1234H1ZX');
    expect(isValidGstin(' 33asdfg1234h1zx ')).toBe(true);
  });
});
