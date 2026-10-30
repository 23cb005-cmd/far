import { ERROR_CODES } from '@farmfair/shared';
import { env } from '../config/env';
import { client } from './helpers';

/**
 * The limiters short-circuit in the test environment unless this flag is set,
 * so unrelated suites are not made flaky by a shared request budget. This file
 * turns them on deliberately.
 */
beforeAll(() => {
  process.env.RATE_LIMIT_IN_TESTS = 'true';
});

afterAll(() => {
  delete process.env.RATE_LIMIT_IN_TESTS;
});

describe('rate limiting', () => {
  it(`limits auth routes to ${env.RATE_LIMIT_AUTH_MAX} requests per window`, async () => {
    const c = await client();

    // /auth/refresh is rate limited but does no password hashing, so the
    // budget can be exhausted quickly.
    for (let i = 0; i < env.RATE_LIMIT_AUTH_MAX; i += 1) {
      const res = await c.post('/auth/refresh');
      expect(res.status).toBe(401);
    }

    const limited = await c.post('/auth/refresh');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
    expect(limited.body.error.message).toMatch(/too many requests/i);
  });

  it('advertises the limit in standard headers', async () => {
    const c = await client();
    const res = await c.post('/auth/refresh');

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  it('does not count safe reads against the auth budget', async () => {
    const c = await client();

    // /auth/csrf is deliberately outside the auth limiter: the client fetches
    // it on load and again after any CSRF failure.
    for (let i = 0; i < env.RATE_LIMIT_AUTH_MAX + 5; i += 1) {
      await c.get('/auth/csrf').expect(200);
    }
  });
});
