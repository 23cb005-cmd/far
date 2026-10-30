import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load `.env` from the server package root regardless of the cwd the process
// was started from (npm workspaces, Docker, and CLIs all differ).
//
// Tests are kept hermetic: they set their own variables in `__tests__/env.setup.ts`
// and must not be influenced by whatever a developer happens to have in `.env`.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const booleanish = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      if (typeof value === 'boolean') return value;
      return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    });

const envSchema = z
  .object({
    // --- core ---
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .refine((v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'), {
        message: 'MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string',
      }),
    CLIENT_URL: z.string().url('CLIENT_URL must be an absolute URL'),

    // --- auth ---
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    COOKIE_DOMAIN: z.string().optional(),

    // --- logging ---
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),

    // --- rate limiting (overridable so tests can relax the limits) ---
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_OTP_MAX: z.coerce.number().int().min(1).default(3),
    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
    TRUST_PROXY: booleanish(false),

    // --- OTP ---
    OTP_PROVIDER: z.enum(['console', 'twilio']).default('console'),

    // ===== optional keys reserved for later phases =====
    // Phase 2 - mandi prices
    DATA_GOV_API_KEY: z.string().optional(),
    DATA_GOV_STATE: z.string().default('Tamil Nadu'),
    // Phase 3 - uploads
    STORAGE_PROVIDER: z.enum(['local', 'cloudinary', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    LISTING_EXPIRY_DAYS: z.coerce.number().int().min(1).default(7),
    // Phase 4 - payments
    PAYMENT_PROVIDER: z.enum(['simulated', 'razorpay']).default('simulated'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    COMMISSION_PERCENT: z.coerce.number().min(0).max(20).default(1),
    // Phase 5 - notifications and jobs
    NOTIFY_PROVIDER: z.enum(['console', 'twilio', 'telegram']).default('console'),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_WHATSAPP_FROM: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    JOBS_ENABLED: booleanish(false),
    PRICE_ALERT_THRESHOLD: z.coerce.number().min(1).max(100).default(10),
    // Phase 6 - WhatsApp bot
    PUBLIC_BASE_URL: z.string().url().optional(),
    // Phase 8 - observability
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }
    if (value.NODE_ENV === 'production') {
      if (!value.CLIENT_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLIENT_URL'],
          message: 'CLIENT_URL must use https in production',
        });
      }
      if (value.PAYMENT_PROVIDER === 'razorpay' && !value.RAZORPAY_KEY_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RAZORPAY_KEY_SECRET'],
          message: 'RAZORPAY_KEY_SECRET is required when PAYMENT_PROVIDER=razorpay',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

/**
 * Treat an empty value as absent.
 *
 * `.env.example` lists every optional key as `KEY=` so the full set is visible,
 * and dotenv turns those into empty strings. Without this, copying the example
 * verbatim would fail validation on, say, `PUBLIC_BASE_URL=` - an empty string
 * is not a URL, and `.optional()` only permits `undefined`.
 */
function blankToUndefined(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === '' ? undefined : value;
  }
  return out;
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(blankToUndefined(process.env));

  if (!parsed.success) {
    // Written to stderr directly: the logger itself depends on this config.
    process.stderr.write(
      `\nInvalid environment configuration:\n${formatIssues(parsed.error)}\n\n` +
        `Copy server/.env.example to server/.env and fill in the values.\n\n`,
    );
    // Refuse to start on bad config rather than running in a half-configured state.
    throw new Error('Invalid environment configuration');
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';

/** Exported for the config unit tests. */
export const __envSchema = envSchema;
