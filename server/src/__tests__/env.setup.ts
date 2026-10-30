/**
 * Runs before anything else (jest `setupFiles`), because `config/env.ts`
 * validates and freezes the configuration the moment it is imported.
 *
 * The MONGODB_URI here only has to satisfy the schema: tests connect to an
 * in-memory server whose real URI is resolved in `setup.ts`.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/farmfair_test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-1234567890';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough-0987654321';
process.env.COOKIE_DOMAIN = '';
process.env.LOG_LEVEL = 'silent';
process.env.OTP_PROVIDER = 'console';
process.env.TRUST_PROXY = 'false';
