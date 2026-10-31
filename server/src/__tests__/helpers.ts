import { API_PREFIX, CSRF_COOKIE, CSRF_HEADER } from '@farmfair/shared';
import { CookieAccessInfo } from 'cookiejar';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../app';
import { User, type UserDocument } from '../models/User';
import { hashPassword } from '../services/password';

export const api = (path: string): string => `${API_PREFIX}${path}`;

let cachedApp: Express | null = null;

/** One app instance per worker; nothing in it is per-request stateful. */
export function app(): Express {
  cachedApp ??= createApp();
  return cachedApp;
}

/**
 * A supertest agent that keeps cookies between requests, plus a CSRF token
 * fetched from the API, so tests exercise the same handshake a browser does.
 */
export class Client {
  readonly agent: request.Agent;
  private fallbackToken = '';

  constructor() {
    this.agent = request.agent(app());
  }

  /** Fetch a CSRF token. Required once before any mutating request. */
  async csrf(): Promise<string> {
    const res = await this.agent.get(api('/auth/csrf')).expect(200);
    this.fallbackToken = res.body.data.csrfToken as string;
    return this.token;
  }

  /**
   * Read the CSRF token out of the cookie jar on every call, exactly as the
   * browser client does. The server rotates the token on register, login,
   * refresh and password change, so a cached value goes stale.
   */
  get token(): string {
    const jar = (this.agent as unknown as { jar?: { getCookies: (a: unknown) => unknown[] } }).jar;
    const cookies = (jar?.getCookies(CookieAccessInfo.All) ?? []) as Array<{
      name: string;
      value: string;
    }>;
    return cookies.find((cookie) => cookie.name === CSRF_COOKIE)?.value ?? this.fallbackToken;
  }

  post(path: string) {
    return this.agent.post(api(path)).set(CSRF_HEADER, this.token);
  }

  /** POST without the CSRF header, for the rejection tests. */
  postRaw(path: string) {
    return this.agent.post(api(path));
  }

  patch(path: string) {
    return this.agent.patch(api(path)).set(CSRF_HEADER, this.token);
  }

  get(path: string) {
    return this.agent.get(api(path));
  }
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * A request with no cookie jar, so the test controls the Cookie header exactly.
 *
 * Needed when planting a forged or stale token: an agent would also send its own
 * valid cookie, and cookie-parser uses whichever arrives first. A matching CSRF
 * pair is supplied automatically so these tests fail on the thing they target.
 */
export function noJar(
  method: 'get' | 'post' | 'patch',
  path: string,
  cookies: Record<string, string> = {},
) {
  const csrfToken = cookies[CSRF_COOKIE] ?? 'test-csrf-token-value';
  return request(app())
    [method](api(path))
    .set('Cookie', cookieHeader({ [CSRF_COOKIE]: csrfToken, ...cookies }))
    .set(CSRF_HEADER, csrfToken);
}

export async function client(): Promise<Client> {
  const c = new Client();
  await c.csrf();
  return c;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const FARMER = {
  name: 'Murugan S',
  phone: '9876543210',
  password: 'farmfair1',
  role: 'farmer' as const,
  district: 'Salem' as const,
  village: 'Attur',
  crops: ['tomato', 'onion'],
};

export const BUYER = {
  name: 'Priya R',
  phone: '9876501234',
  password: 'farmfair1',
  role: 'buyer' as const,
  district: 'Coimbatore' as const,
  business: { name: 'Priya Traders', gstNumber: '33ASDFG1234H1ZX' },
};

/** Create a user directly, bypassing the HTTP layer. */
export async function seedUser(
  overrides: Partial<{
    name: string;
    phone: string;
    password: string;
    role: 'farmer' | 'buyer' | 'admin';
    district: string;
    crops: string[];
    verificationStatus: string;
    isSuspended: boolean;
    business: { name: string; gstNumber?: string };
  }> = {},
): Promise<UserDocument> {
  const role = overrides.role ?? 'farmer';
  return User.create({
    name: overrides.name ?? 'Test User',
    phone: overrides.phone ?? '+919000000001',
    passwordHash: await hashPassword(overrides.password ?? 'farmfair1'),
    role,
    district: overrides.district ?? 'Salem',
    crops: overrides.crops ?? (role === 'farmer' ? ['tomato'] : []),
    ...(role === 'buyer'
      ? { business: overrides.business ?? { name: 'Test Traders' } }
      : overrides.business
        ? { business: overrides.business }
        : {}),
    ...(overrides.verificationStatus ? { verificationStatus: overrides.verificationStatus } : {}),
    ...(overrides.isSuspended !== undefined ? { isSuspended: overrides.isSuspended } : {}),
  });
}

/** Register through the API and return a logged-in client. */
export async function registerAndLogin(
  payload: Record<string, unknown> = FARMER,
): Promise<{ c: Client; body: Record<string, unknown> }> {
  const c = await client();
  const res = await c.post('/auth/register').send(payload).expect(201);
  return { c, body: res.body };
}

/**
 * Seed a user directly (so fields the public API cannot set, like an
 * `approved` buyer, can be set up), then sign in through the real HTTP flow
 * so the test exercises the same session/CSRF handshake a browser does.
 */
export async function seedAndLogin(
  overrides: Parameters<typeof seedUser>[0] & { password?: string } = {},
): Promise<Client> {
  const password = overrides.password ?? 'farmfair1';
  const user = await seedUser({ ...overrides, password });
  const c = await client();
  await c.post('/auth/login').send({ phone: user.phone, password }).expect(200);
  return c;
}

/** Pull a named cookie value out of a supertest response. */
export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const cookie of cookies) {
    const match = new RegExp(`^${name}=([^;]*)`).exec(cookie);
    if (match) return decodeURIComponent(match[1] ?? '');
  }
  return undefined;
}

/** Full Set-Cookie string for a named cookie, for attribute assertions. */
export function cookieString(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

export { CSRF_COOKIE, CSRF_HEADER };
