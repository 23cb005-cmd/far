import { ACCESS_COOKIE, ERROR_CODES, MAX_FAILED_LOGINS } from '@farmfair/shared';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { FARMER, client, cookieValue, seedUser } from './helpers';

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await seedUser({ phone: '+919876543210', password: 'farmfair1', role: 'farmer' });
  });

  it('signs in with a correct phone and password', async () => {
    const c = await client();
    const res = await c
      .post('/auth/login')
      .send({ phone: '9876543210', password: 'farmfair1' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.phone).toBe('+919876543210');
    expect(cookieValue(res, ACCESS_COOKIE)).toBeTruthy();
  });

  it('accepts any common phone format', async () => {
    const c = await client();
    await c
      .post('/auth/login')
      .send({ phone: '+91 98765 43210', password: 'farmfair1' })
      .expect(200);
  });

  it('records lastLoginAt', async () => {
    const c = await client();
    await c.post('/auth/login').send({ phone: '9876543210', password: 'farmfair1' }).expect(200);

    const user = await User.findOne({ phone: '+919876543210' }).exec();
    expect(user?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('returns the same generic error for a wrong password and an unknown phone', async () => {
    const c = await client();

    const wrongPassword = await c
      .post('/auth/login')
      .send({ phone: '9876543210', password: 'wrongpass1' })
      .expect(401);

    const unknownPhone = await c
      .post('/auth/login')
      .send({ phone: '9000000099', password: 'farmfair1' })
      .expect(401);

    expect(wrongPassword.body.error.message).toBe('Invalid phone or password');
    expect(unknownPhone.body.error).toEqual(wrongPassword.body.error);
    expect(wrongPassword.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('does not set session cookies on a failed login', async () => {
    const c = await client();
    const res = await c
      .post('/auth/login')
      .send({ phone: '9876543210', password: 'wrongpass1' })
      .expect(401);

    expect(cookieValue(res, ACCESS_COOKIE)).toBeUndefined();
  });

  it('rejects a malformed phone with 400 before touching the database', async () => {
    const c = await client();
    const res = await c.post('/auth/login').send({ phone: '123', password: 'x' }).expect(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('blocks a suspended account even with correct credentials', async () => {
    await User.updateOne(
      { phone: '+919876543210' },
      { $set: { isSuspended: true, suspensionReason: 'Fraudulent listings' } },
    );

    const c = await client();
    const res = await c
      .post('/auth/login')
      .send({ phone: '9876543210', password: 'farmfair1' })
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
    expect(res.body.error.message).toContain('Fraudulent listings');
  });

  describe('account lockout', () => {
    const wrong = { phone: '9876543210', password: 'wrongpass1' };

    it(`locks the account for 15 minutes after ${MAX_FAILED_LOGINS} failed attempts`, async () => {
      const c = await client();

      for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
        await c.post('/auth/login').send(wrong).expect(401);
      }

      // The sixth attempt is refused because the account is now locked, even
      // though the password supplied this time is correct.
      const res = await c
        .post('/auth/login')
        .send({ phone: '9876543210', password: 'farmfair1' })
        .expect(423);

      expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);
      expect(res.body.error.message).toMatch(/minute/);

      const user = await User.findOne({ phone: '+919876543210' }).exec();
      expect(user?.lockUntil).toBeInstanceOf(Date);
      expect((user?.lockUntil as Date).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
      expect((user?.lockUntil as Date).getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
    });

    it(`still allows sign-in after ${MAX_FAILED_LOGINS - 1} failures`, async () => {
      const c = await client();
      for (let i = 0; i < MAX_FAILED_LOGINS - 1; i += 1) {
        await c.post('/auth/login').send(wrong).expect(401);
      }
      await c.post('/auth/login').send({ phone: '9876543210', password: 'farmfair1' }).expect(200);
    });

    it('resets the failure counter on a successful sign-in', async () => {
      const c = await client();
      await c.post('/auth/login').send(wrong).expect(401);
      await c.post('/auth/login').send(wrong).expect(401);

      await c.post('/auth/login').send({ phone: '9876543210', password: 'farmfair1' }).expect(200);

      const user = await User.findOne({ phone: '+919876543210' }).exec();
      expect(user?.failedLoginCount).toBe(0);
      expect(user?.lockUntil).toBeUndefined();
    });

    it('allows sign-in again once the lock has expired', async () => {
      const c = await client();
      for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
        await c.post('/auth/login').send(wrong).expect(401);
      }

      // Simulate the clock moving past the lock window.
      await User.updateOne(
        { phone: '+919876543210' },
        { $set: { lockUntil: new Date(Date.now() - 1000) } },
      );

      await c.post('/auth/login').send({ phone: '9876543210', password: 'farmfair1' }).expect(200);
    });
  });

  describe('audit trail', () => {
    it('records a successful login', async () => {
      const c = await client();
      await c.post('/auth/login').send({ phone: '9876543210', password: 'farmfair1' }).expect(200);

      const entry = await AuditLog.findOne({ action: 'auth.login.success' }).exec();
      expect(entry).not.toBeNull();
      expect(entry?.actor).not.toBeNull();
    });

    it('records a failed login with the phone masked', async () => {
      const c = await client();
      await c.post('/auth/login').send({ phone: '9876543210', password: 'nope12345' }).expect(401);

      const entry = await AuditLog.findOne({ action: 'auth.login.failure' }).exec();
      expect(entry).not.toBeNull();
      expect(entry?.metadata?.phone).toBe('+91*****43210');
    });

    it('records a lockout separately from an ordinary failure', async () => {
      const c = await client();
      for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
        await c
          .post('/auth/login')
          .send({ phone: '9876543210', password: 'nope12345' })
          .expect(401);
      }
      await c.post('/auth/login').send({ phone: '9876543210', password: 'farmfair1' }).expect(423);

      expect(await AuditLog.countDocuments({ action: 'auth.login.locked' })).toBe(1);
    });

    it('never stores a password in the audit metadata', async () => {
      const c = await client();
      await c
        .post('/auth/login')
        .send({ phone: '9876543210', password: 'secretpass1' })
        .expect(401);

      const entries = await AuditLog.find({}).lean().exec();
      expect(JSON.stringify(entries)).not.toContain('secretpass1');
    });
  });

  it('works end to end from registration through sign-in', async () => {
    await User.deleteMany({});
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);
    await c.post('/auth/logout').expect(200);
    await c
      .post('/auth/login')
      .send({ phone: FARMER.phone, password: FARMER.password })
      .expect(200);
  });
});
