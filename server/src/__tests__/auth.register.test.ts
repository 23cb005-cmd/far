import { ACCESS_COOKIE, ERROR_CODES, REFRESH_COOKIE } from '@farmfair/shared';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { BUYER, FARMER, client, cookieString, cookieValue } from './helpers';

describe('POST /auth/register', () => {
  it('registers a farmer, normalises the phone and sets session cookies', async () => {
    const c = await client();
    const res = await c.post('/auth/register').send(FARMER).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      name: 'Murugan S',
      phone: '+919876543210',
      role: 'farmer',
      district: 'Salem',
      crops: ['tomato', 'onion'],
    });

    expect(cookieValue(res, ACCESS_COOKIE)).toBeTruthy();
    expect(cookieValue(res, REFRESH_COOKIE)).toBeTruthy();
  });

  it('never returns the password hash or internal security fields', async () => {
    const c = await client();
    const res = await c.post('/auth/register').send(FARMER).expect(201);

    const user = res.body.data.user as Record<string, unknown>;
    expect(user.passwordHash).toBeUndefined();
    expect(user.tokenVersion).toBeUndefined();
    expect(user.failedLoginCount).toBeUndefined();
    expect(user.lockUntil).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('argon2');
  });

  it('scopes the refresh cookie to the auth routes and marks both httpOnly', async () => {
    const c = await client();
    const res = await c.post('/auth/register').send(FARMER).expect(201);

    const access = cookieString(res, ACCESS_COOKIE) ?? '';
    const refresh = cookieString(res, REFRESH_COOKIE) ?? '';

    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Strict/i);
    expect(access).toMatch(/Path=\//);

    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/SameSite=Strict/i);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('creates a buyer with pending verification', async () => {
    const c = await client();
    const res = await c.post('/auth/register').send(BUYER).expect(201);

    expect(res.body.data.user).toMatchObject({
      role: 'buyer',
      verificationStatus: 'pending',
      business: { name: 'Priya Traders', gstNumber: '33ASDFG1234H1ZX' },
    });
  });

  it('marks farmers as not requiring verification', async () => {
    const c = await client();
    const res = await c.post('/auth/register').send(FARMER).expect(201);
    expect(res.body.data.user.verificationStatus).toBe('not_required');
  });

  it('rejects a duplicate phone number with 409', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c
      .post('/auth/register')
      .send({ ...FARMER, name: 'Someone Else' })
      .expect(409);

    expect(res.body.error.code).toBe(ERROR_CODES.DUPLICATE_KEY);
    expect(await User.countDocuments({})).toBe(1);
  });

  it('treats differently formatted versions of the same number as duplicates', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c
      .post('/auth/register')
      .send({ ...FARMER, phone: '+91 98765 43210' })
      .expect(409);
  });

  it.each([
    ['missing name', { name: undefined }],
    ['short password', { password: 'abc1' }],
    ['password without a number', { password: 'abcdefgh' }],
    ['invalid phone', { phone: '12345' }],
    ['district outside Tamil Nadu', { district: 'Bengaluru' }],
    ['unknown crop', { crops: ['dragonfruit'] }],
    ['farmer with no crops', { crops: [] }],
    ['admin role', { role: 'admin' }],
  ])('rejects %s with 400 and field details', async (_label, patch) => {
    const c = await client();
    const res = await c
      .post('/auth/register')
      .send({ ...FARMER, ...patch })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects a buyer without a business name', async () => {
    const c = await client();
    const res = await c
      .post('/auth/register')
      .send({ ...BUYER, business: undefined })
      .expect(400);

    expect(
      (res.body.error.details as Array<{ path: string }>).some((d) => d.path === 'business.name'),
    ).toBe(true);
  });

  it('rejects a buyer with a malformed GSTIN', async () => {
    const c = await client();
    await c
      .post('/auth/register')
      .send({ ...BUYER, business: { name: 'Priya Traders', gstNumber: 'NOTAGST' } })
      .expect(400);
  });

  it('strips unknown fields instead of trusting them', async () => {
    const c = await client();
    const res = await c
      .post('/auth/register')
      .send({ ...FARMER, role: 'farmer', isSuspended: true, ratingAvg: 5, tokenVersion: 99 })
      .expect(201);

    expect(res.body.data.user.isSuspended).toBe(false);
    expect(res.body.data.user.ratingAvg).toBe(0);

    const stored = await User.findOne({ phone: '+919876543210' }).exec();
    expect(stored?.tokenVersion).toBe(0);
    expect(stored?.isSuspended).toBe(false);
  });

  it('stores an argon2id hash, never the plaintext password', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const stored = await User.findOne({ phone: '+919876543210' }).exec();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain('farmfair1');
  });

  it('writes an audit entry with a masked phone number', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const entry = await AuditLog.findOne({ action: 'auth.register' }).exec();
    expect(entry).not.toBeNull();
    expect(entry?.metadata?.phone).toBe('+91*****43210');
    expect(JSON.stringify(entry?.metadata)).not.toContain('9876543210');
  });
});
