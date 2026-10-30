import { maskPhone } from '@farmfair/shared';
import pino, { type LoggerOptions } from 'pino';
import { env, isDevelopment, isProduction, isTest } from './env';

/**
 * Paths that must never reach the log sink in readable form. Pino redacts these
 * by path; anything that is a secret (tokens, cookies, passwords) is removed
 * outright rather than masked, because a partial token is still a liability.
 */
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'csrfToken',
  'code',
  'codeHash',
  '*.password',
  '*.passwordHash',
  '*.token',
  'body.password',
  'body.newPassword',
  'body.currentPassword',
  'body.code',
];

const options: LoggerOptions = {
  level: env.LOG_LEVEL ?? (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  base: { service: 'farmfair-api', env: env.NODE_ENV },
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Phone numbers are personal data: mask any that appear as a top-level field
  // on a log entry so they are useful for support without being identifying.
  hooks: {
    logMethod(args, method) {
      const [first] = args;
      if (first && typeof first === 'object') {
        const obj = first as Record<string, unknown>;
        if (typeof obj.phone === 'string') obj.phone = maskPhone(obj.phone);
        if (typeof obj.to === 'string' && obj.to.startsWith('+91')) obj.to = maskPhone(obj.to);
      }
      return method.apply(this, args);
    },
  },
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname,service,env',
            singleLine: false,
          },
        },
      }
    : {}),
};

export const logger = pino(options);

export type Logger = typeof logger;
