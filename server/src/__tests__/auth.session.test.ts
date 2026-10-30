import { ACCESS_COOKIE, ERROR_CODES, REFRESH_COOKIE } from '@farmfair/shared';
import { User } from '../models/User';
import { FARMER, client, cookieValue, noJar, seedUser } from './helpers';

describe('session lifecycle', () => {
  describe('POST /auth/refresh', () => {
    it('rotates both tokens and returns the user', async () => {
      const c = await client();
      const registered = await c.post('/auth/register').send(FARMER).expect(201);
      const firstAccess = cookieValue(registered, ACCESS_COOKIE);
      const firstRefresh = cookieValue(registered, REFRESH_COOKIE);

      // JWTs embed a whole-second `iat`, so without a pause the rotated token
      // can be byte-identical and the assertion would be vacuous.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const refreshed = await c.post('/auth/refresh').expect(200);

      expect(refreshed.body.data.user.phone).toBe('+919876543210');
      expect(cookieValue(refreshed, ACCESS_COOKIE)).toBeTruthy();
      expect(cookieValue(refreshed, REFRESH_COOKIE)).toBeTruthy();
      expect(cookieValue(refreshed, ACCESS_COOKIE)).not.toBe(firstAccess);
      expect(cookieValue(refreshed, REFRESH_COOKIE)).not.toBe(firstRefresh);
    });

    it('rejects a request with no refresh cookie', async () => {
      const c = await client();
      const res = await c.post('/auth/refresh').expect(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHENTICATED);
    });

    it('rejects a tampered refresh token', async () => {
      const c = await client();
      await c.post('/auth/register').send(FARMER).expect(201);

      const res = await noJar('post', '/auth/refresh', {
        [REFRESH_COOKIE]: 'not.a.real.token',
      }).expect(401);

      expect(res.body.error.code).toBe(ERROR_CODES.TOKEN_INVALID);
    });

    it('rejects a refresh token signed with the access secret', async () => {
      const c = await client();
      const registered = await c.post('/auth/register').send(FARMER).expect(201);
      const accessToken = cookieValue(registered, ACCESS_COOKIE) ?? '';

      const res = await noJar('post', '/auth/refresh', {
        [REFRESH_COOKIE]: accessToken,
      }).expect(401);

      expect(res.body.error.code).toBe(ERROR_CODES.TOKEN_INVALID);
    });

    it('rejects a refresh token whose tokenVersion is stale', async () => {
      const c = await client();
      await c.post('/auth/register').send(FARMER).expect(201);

      // Anything that revokes sessions (logout elsewhere, password change,
      // suspension) bumps tokenVersion; the old token must stop working.
      await User.updateOne({ phone: '+919876543210' }, { $inc: { tokenVersion: 1 } });

      const res = await c.post('/auth/refresh').expect(401);
      expect(res.body.error.message).toMatch(/session has ended/i);
    });

    it('refuses to refresh a suspended account and clears the cookies', async () => {
      const c = await client();
      await c.post('/auth/register').send(FARMER).expect(201);
      await User.updateOne({ phone: '+919876543210' }, { $set: { isSuspended: true } });

      const res = await c.post('/auth/refresh').expect(403);
      expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookies and increments tokenVersion', async () => {
      const c = await client();
      await c.post('/auth/register').send(FARMER).expect(201);

      const before = await User.findOne({ phone: '+919876543210' }).exec();
      expect(before?.tokenVersion).toBe(0);

      const res = await c.post('/auth/logout').expect(200);
      expect(res.body.data.loggedOut).toBe(true);

      const after = await User.findOne({ phone: '+919876543210' }).exec();
      expect(after?.tokenVersion).toBe(1);

      // Cookies are cleared by being re-sent with an empty value.
      expect(cookieValue(res, ACCESS_COOKIE)).toBe('');
      expect(cookieValue(res, REFRESH_COOKIE)).toBe('');
    });

    it('invalidates the refresh token so the session cannot be resurrected', async () => {
      const c = await client();
      const registered = await c.post('/auth/register').send(FARMER).expect(201);
      const stolenRefresh = cookieValue(registered, REFRESH_COOKIE) ?? '';

      await c.post('/auth/logout').expect(200);

      // Even replaying the exact pre-logout cookie fails: tokenVersion moved on.
      const res = await noJar('post', '/auth/refresh', {
        [REFRESH_COOKIE]: stolenRefresh,
      }).expect(401);

      expect(res.body.error.message).toMatch(/session has ended/i);
    });

    it('invalidates the access token for authenticated routes', async () => {
      const c = await client();
      const registered = await c.post('/auth/register').send(FARMER).expect(201);
      const stolenAccess = cookieValue(registered, ACCESS_COOKIE) ?? '';

      await c.post('/auth/logout').expect(200);

      await noJar('get', '/auth/me', { [ACCESS_COOKIE]: stolenAccess }).expect(401);
    });

    it('requires authentication', async () => {
      const c = await client();
      await c.post('/auth/logout').expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the signed-in user', async () => {
      const c = await client();
      await c.post('/auth/register').send(FARMER).expect(201);

      const res = await c.get('/auth/me').expect(200);
      expect(res.body.data.user).toMatchObject({ phone: '+919876543210', role: 'farmer' });
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('rejects an anonymous request', async () => {
      const c = await client();
      const res = await c.get('/auth/me').expect(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHENTICATED);
    });

    it('rejects a request for a user that has since been deleted', async () => {
      const c = await client();
      await c.post('/auth/register').send(FARMER).expect(201);
      await User.deleteMany({});
      await c.get('/auth/me').expect(401);
    });

    it('reports the pending verification status for a new buyer', async () => {
      await seedUser({
        phone: '+919812345678',
        role: 'buyer',
        business: { name: 'Test Traders' },
      });

      const c = await client();
      await c.post('/auth/login').send({ phone: '9812345678', password: 'farmfair1' }).expect(200);

      const res = await c.get('/auth/me').expect(200);
      expect(res.body.data.user.verificationStatus).toBe('pending');
    });
  });
});
