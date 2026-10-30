import { ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER, ERROR_CODES } from '@farmfair/shared';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { requireAuth, requireRole, requireVerifiedBuyer, blockSuspended } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { User } from '../models/User';
import { signToken } from '../services/tokens';
import { FARMER, app, client, noJar, seedUser } from './helpers';

describe('CSRF protection', () => {
  it('rejects a POST with no CSRF header', async () => {
    const c = await client();
    const res = await c.postRaw('/auth/login').send({ phone: '9876543210', password: 'x' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.CSRF_INVALID);
  });

  it('rejects a POST whose header does not match the cookie', async () => {
    const c = await client();
    const res = await c.agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, 'a-token-of-the-wrong-value')
      .send({ phone: '9876543210', password: 'farmfair1' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.CSRF_INVALID);
  });

  it('rejects a POST with a header but no cookie', async () => {
    const res = await request(app())
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, 'orphan-header-token')
      .send({ phone: '9876543210', password: 'farmfair1' });

    expect(res.status).toBe(403);
  });

  it('accepts a POST when the header matches the cookie', async () => {
    await seedUser({ phone: '+919876543210' });
    const c = await client();
    await c.post('/auth/login').send({ phone: '9876543210', password: 'farmfair1' }).expect(200);
  });

  it('issues a readable CSRF cookie so the client can echo it', async () => {
    const res = await request(app()).get('/api/v1/auth/csrf').expect(200);
    const raw = res.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : [raw];
    const csrf = cookies.find((cookie) => cookie.startsWith(`${CSRF_COOKIE}=`)) ?? '';

    expect(csrf).not.toMatch(/HttpOnly/i);
    expect(csrf).toMatch(/SameSite=Strict/i);
    expect(res.body.data.csrfToken).toBeTruthy();
  });

  it('does not require a token for safe methods', async () => {
    await request(app()).get('/api/v1/health').expect(200);
    await request(app()).get('/api/v1/auth/csrf').expect(200);
  });

  it('protects PATCH as well as POST', async () => {
    const c = await client();
    await c.post('/auth/register').send(FARMER).expect(201);

    const res = await c.agent.patch('/api/v1/auth/me').send({ name: 'No Token' });
    expect(res.status).toBe(403);
  });
});

describe('role and status middleware', () => {
  /**
   * Mounted on a throwaway app so the guards are tested in isolation, without
   * depending on which routes happen to use them in this phase.
   */
  function guardApp() {
    const instance = express();
    instance.use(express.json());
    instance.use(cookieParser());

    instance.get('/admin-only', requireAuth, requireRole('admin'), (_req, res) => {
      res.json({ success: true, data: { ok: true } });
    });
    instance.get('/farmer-only', requireAuth, requireRole('farmer'), (_req, res) => {
      res.json({ success: true, data: { ok: true } });
    });
    instance.get('/staff', requireAuth, requireRole('farmer', 'admin'), (_req, res) => {
      res.json({ success: true, data: { ok: true } });
    });
    instance.get('/verified-buyer', requireAuth, requireVerifiedBuyer, (_req, res) => {
      res.json({ success: true, data: { ok: true } });
    });
    instance.get('/active', requireAuth, blockSuspended, (_req, res) => {
      res.json({ success: true, data: { ok: true } });
    });
    instance.use(errorHandler);
    return instance;
  }

  async function tokenFor(phone: string): Promise<string> {
    const user = await User.findOne({ phone }).exec();
    if (!user) throw new Error(`No user ${phone}`);
    return signToken('access', {
      sub: String(user._id),
      role: user.role,
      tv: user.tokenVersion,
    });
  }

  it('allows a matching role', async () => {
    await seedUser({ phone: '+919000000010', role: 'admin', district: 'Chennai' });
    const token = await tokenFor('+919000000010');

    await request(guardApp())
      .get('/admin-only')
      .set('Cookie', `${ACCESS_COOKIE}=${token}`)
      .expect(200);
  });

  it('rejects a non-matching role with 403', async () => {
    await seedUser({ phone: '+919000000011', role: 'farmer' });
    const token = await tokenFor('+919000000011');

    const res = await request(guardApp())
      .get('/admin-only')
      .set('Cookie', `${ACCESS_COOKIE}=${token}`)
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('accepts any of several allowed roles', async () => {
    await seedUser({ phone: '+919000000012', role: 'farmer' });
    const token = await tokenFor('+919000000012');

    await request(guardApp()).get('/staff').set('Cookie', `${ACCESS_COOKIE}=${token}`).expect(200);
  });

  it('rejects an anonymous request with 401, not 403', async () => {
    await request(guardApp()).get('/admin-only').expect(401);
  });

  it('allows an approved buyer through requireVerifiedBuyer', async () => {
    await seedUser({
      phone: '+919000000013',
      role: 'buyer',
      verificationStatus: 'approved',
      business: { name: 'Approved Traders' },
    });
    const token = await tokenFor('+919000000013');

    await request(guardApp())
      .get('/verified-buyer')
      .set('Cookie', `${ACCESS_COOKIE}=${token}`)
      .expect(200);
  });

  it('blocks a pending buyer with a message explaining they can still browse', async () => {
    await seedUser({
      phone: '+919000000014',
      role: 'buyer',
      business: { name: 'Pending Traders' },
    });
    const token = await tokenFor('+919000000014');

    const res = await request(guardApp())
      .get('/verified-buyer')
      .set('Cookie', `${ACCESS_COOKIE}=${token}`)
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.BUYER_NOT_VERIFIED);
    expect(res.body.error.message).toMatch(/browse/i);
  });

  it('blocks a rejected buyer', async () => {
    await seedUser({
      phone: '+919000000015',
      role: 'buyer',
      verificationStatus: 'rejected',
      business: { name: 'Rejected Traders' },
    });
    const token = await tokenFor('+919000000015');

    const res = await request(guardApp())
      .get('/verified-buyer')
      .set('Cookie', `${ACCESS_COOKIE}=${token}`)
      .expect(403);

    expect(res.body.error.message).toMatch(/not approved/i);
  });

  it('blocks a farmer from a buyer-only route', async () => {
    await seedUser({ phone: '+919000000016', role: 'farmer' });
    const token = await tokenFor('+919000000016');

    await request(guardApp())
      .get('/verified-buyer')
      .set('Cookie', `${ACCESS_COOKIE}=${token}`)
      .expect(403);
  });

  it('blocks a suspended user', async () => {
    await seedUser({ phone: '+919000000017', role: 'farmer', isSuspended: true });
    const token = await tokenFor('+919000000017');

    const res = await request(guardApp())
      .get('/active')
      .set('Cookie', `${ACCESS_COOKIE}=${token}`)
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
  });

  it('allows an active user', async () => {
    await seedUser({ phone: '+919000000018', role: 'farmer' });
    const token = await tokenFor('+919000000018');

    await request(guardApp()).get('/active').set('Cookie', `${ACCESS_COOKIE}=${token}`).expect(200);
  });

  it('rejects an access token whose tokenVersion is stale', async () => {
    await seedUser({ phone: '+919000000019', role: 'farmer' });
    const token = await tokenFor('+919000000019');
    await User.updateOne({ phone: '+919000000019' }, { $inc: { tokenVersion: 1 } });

    await request(guardApp()).get('/active').set('Cookie', `${ACCESS_COOKIE}=${token}`).expect(401);
  });
});

describe('request hardening', () => {
  it('returns 404 in the standard envelope for an unknown route', async () => {
    const res = await request(app()).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ success: false, error: { code: ERROR_CODES.NOT_FOUND } });
  });

  it('rejects a body larger than 100 kb', async () => {
    const c = await client();
    const res = await c.post('/auth/register').send({ ...FARMER, village: 'x'.repeat(200 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe(ERROR_CODES.PAYLOAD_TOO_LARGE);
  });

  it('rejects malformed JSON with 400, not 500', async () => {
    const c = await client();
    const res = await c.agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, c.token)
      .set('Content-Type', 'application/json')
      .send('{"phone": ');

    expect(res.status).toBe(400);
  });

  it('strips mongo operators from the request body', async () => {
    await seedUser({ phone: '+919876543210' });
    const c = await client();

    // A classic NoSQL injection: { $ne: null } would match any password.
    const res = await c.post('/auth/login').send({ phone: '9876543210', password: { $ne: null } });

    expect([400, 401]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('sets the expected security headers', async () => {
    const res = await request(app()).get('/api/v1/health').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("object-src 'none'");
    expect(res.headers['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('echoes a request id for correlation', async () => {
    const res = await request(app()).get('/api/v1/health').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{8,}$/);
  });

  it('rejects a request from a disallowed origin', async () => {
    const res = await request(app())
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example.com');

    // The CORS middleware errors, which the central handler turns into a 500
    // without leaking anything; the important part is that no CORS headers are
    // granted to the foreign origin.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows the configured client origin with credentials', async () => {
    const res = await request(app())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('GET /health', () => {
  it('reports status, version, uptime and database state', async () => {
    const res = await request(app()).get('/api/v1/health').expect(200);

    expect(res.body.data).toMatchObject({
      status: 'ok',
      version: expect.any(String),
      environment: 'test',
      db: { status: 'connected' },
    });
    expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.data.timestamp).toBe('string');
  });

  it('is reachable without authentication', async () => {
    await noJar('get', '/health').expect(200);
  });
});
