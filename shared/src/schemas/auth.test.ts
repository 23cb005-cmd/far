import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  loginSchema,
  otpVerifySchema,
  registerSchema,
  updateProfileSchema,
} from './auth';

const validFarmer = {
  name: 'Murugan S',
  phone: '98765 43210',
  password: 'farmfair1',
  role: 'farmer' as const,
  district: 'Salem' as const,
  village: 'Attur',
  crops: ['tomato', 'onion'],
};

const validBuyer = {
  name: 'Priya R',
  phone: '9876501234',
  password: 'farmfair1',
  role: 'buyer' as const,
  district: 'Coimbatore' as const,
  business: { name: 'Priya Traders', gstNumber: '33ASDFG1234H1ZX' },
};

describe('registerSchema', () => {
  it('accepts a valid farmer and normalises the phone', () => {
    const result = registerSchema.safeParse(validFarmer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+919876543210');
      expect(result.data.language).toBe('en');
    }
  });

  it('accepts a valid buyer with business details', () => {
    const result = registerSchema.safeParse(validBuyer);
    expect(result.success).toBe(true);
  });

  it('requires a business name for buyers', () => {
    const result = registerSchema.safeParse({ ...validBuyer, business: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'business.name')).toBe(true);
    }
  });

  it('requires at least one crop for farmers', () => {
    const result = registerSchema.safeParse({ ...validFarmer, crops: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'crops')).toBe(true);
    }
  });

  it('rejects the admin role', () => {
    const result = registerSchema.safeParse({ ...validFarmer, role: 'admin' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown crop', () => {
    const result = registerSchema.safeParse({ ...validFarmer, crops: ['dragonfruit'] });
    expect(result.success).toBe(false);
  });

  it('rejects a district outside Tamil Nadu', () => {
    const result = registerSchema.safeParse({ ...validFarmer, district: 'Bengaluru' });
    expect(result.success).toBe(false);
  });

  it('de-duplicates crops', () => {
    const result = registerSchema.safeParse({
      ...validFarmer,
      crops: ['tomato', 'tomato', 'onion'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.crops).toEqual(['tomato', 'onion']);
  });

  it.each([
    ['short', 'abc1'],
    ['no number', 'abcdefgh'],
    ['no letter', '12345678'],
  ])('rejects a password that is %s', (_label, password) => {
    const result = registerSchema.safeParse({ ...validFarmer, password });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid GSTIN but allows it to be omitted', () => {
    expect(
      registerSchema.safeParse({
        ...validBuyer,
        business: { name: 'Priya Traders', gstNumber: 'BADGST' },
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({ ...validBuyer, business: { name: 'Priya Traders' } }).success,
    ).toBe(true);
  });

  it('accepts a Tamil name', () => {
    const result = registerSchema.safeParse({ ...validFarmer, name: 'முருகன்' });
    expect(result.success).toBe(true);
  });

  it('rejects a name with digits or markup', () => {
    expect(registerSchema.safeParse({ ...validFarmer, name: '<script>' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validFarmer, name: 'Bob123' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('normalises the phone and keeps the password verbatim', () => {
    const result = loginSchema.safeParse({ phone: '098765 43210', password: 'x' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+919876543210');
      expect(result.data.password).toBe('x');
    }
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ phone: '9876543210', password: '' }).success).toBe(false);
  });

  it('rejects an invalid phone', () => {
    expect(loginSchema.safeParse({ phone: '123', password: 'farmfair1' }).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts a partial update', () => {
    expect(updateProfileSchema.safeParse({ village: 'Mettur' }).success).toBe(true);
  });

  it('rejects an empty object', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown keys so privileged fields cannot be smuggled in', () => {
    expect(updateProfileSchema.safeParse({ role: 'admin' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ratingAvg: 5 }).success).toBe(false);
  });

  it('does not allow the phone to be changed here', () => {
    expect(updateProfileSchema.safeParse({ phone: '9876543210' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts a valid change', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'farmfair1', newPassword: 'farmfair2' })
        .success,
    ).toBe(true);
  });

  it('rejects reusing the same password', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'farmfair1', newPassword: 'farmfair1' })
        .success,
    ).toBe(false);
  });

  it('applies the password policy to the new password', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'farmfair1', newPassword: 'short' })
        .success,
    ).toBe(false);
  });
});

describe('otpVerifySchema', () => {
  it('accepts a six-digit code', () => {
    expect(otpVerifySchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it.each(['12345', '1234567', 'abcdef', ''])('rejects %s', (code) => {
    expect(otpVerifySchema.safeParse({ code }).success).toBe(false);
  });
});
