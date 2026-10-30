import mongoose from 'mongoose';
import { env, isProduction, isTest } from './env';
import { logger } from './logger';

const MAX_RETRIES = isTest ? 1 : 10;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15000;

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Global Mongoose configuration, applied at import time so that tests - which
 * connect to an in-memory server directly - run against exactly the same
 * settings as production.
 *
 * Note on `sanitizeFilter`: it is deliberately NOT enabled. It wraps every
 * operator in every filter with `$eq`, including filters the server itself
 * builds (`{ consumedAt: { $exists: false } }`), which breaks them. Operator
 * injection is instead blocked at the edge, where the untrusted data actually
 * arrives: `express-mongo-sanitize` strips `$` and `.` from request keys, and
 * `validate()` replaces the body with Zod-parsed output containing only known,
 * correctly typed fields.
 */
mongoose.set('strictQuery', true);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Human-readable connection state, used by the health endpoint. */
export function dbStatus():
  'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'uninitialized' {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    case 0:
      return 'disconnected';
    default:
      return 'uninitialized';
  }
}

export function dbName(): string | undefined {
  return mongoose.connection.name;
}

/**
 * Connect to MongoDB, retrying with exponential backoff. Resolves once the
 * connection is usable; rejects after MAX_RETRIES so the process can exit
 * rather than silently serving errors.
 */
export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  connecting = (async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const conn = await mongoose.connect(uri, {
          serverSelectionTimeoutMS: isTest ? 5000 : 10000,
          socketTimeoutMS: 45000,
          maxPoolSize: 20,
          minPoolSize: 2,
          autoIndex: !isProduction,
        });
        logger.info({ db: conn.connection.name, attempt }, 'MongoDB connected');
        return conn;
      } catch (error) {
        lastError = error;
        const wait = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
        logger.warn(
          { attempt, maxRetries: MAX_RETRIES, retryInMs: wait, err: (error as Error).message },
          'MongoDB connection failed, retrying',
        );
        if (attempt < MAX_RETRIES) await delay(wait);
      }
    }

    connecting = null;
    throw lastError instanceof Error
      ? lastError
      : new Error('Could not connect to MongoDB after multiple attempts');
  })();

  return connecting;
}

export async function disconnectDb(): Promise<void> {
  connecting = null;
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close(false);
  logger.info('MongoDB connection closed');
}

/** Log connection lifecycle once, at import time. */
mongoose.connection.on('disconnected', () => {
  if (!isTest) logger.warn('MongoDB disconnected');
});
mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});
mongoose.connection.on('error', (error: Error) => {
  logger.error({ err: error.message }, 'MongoDB connection error');
});
