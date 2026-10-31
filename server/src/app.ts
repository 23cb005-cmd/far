import path from 'node:path';
import { API_PREFIX, CSRF_HEADER } from '@farmfair/shared';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import hpp from 'hpp';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env, isDevelopment, isProduction, isTest } from './config/env';
import { logger } from './config/logger';
import { openApiDocument } from './docs/openapi';
import { csrfProtection } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';
import { requestId, REQUEST_ID_HEADER } from './middleware/requestId';
import { apiRouter } from './routes';

/**
 * Build the Express application.
 *
 * The middleware order below is deliberate and should not be rearranged:
 *
 *   1. request id      - so every later log line and error can be correlated
 *   2. request logging - attached early to capture even rejected requests
 *   3. helmet          - security headers before anything can write a body
 *   4. CORS            - reject foreign origins before doing any work
 *   5. compression     - wraps the response stream
 *   6. body parsing    - 100 kb cap, before anything reads req.body
 *   7. cookie-parser   - CSRF and auth both need parsed cookies
 *   8. mongo-sanitize  - strip $/. operators from input
 *   9. hpp             - collapse duplicated query parameters
 *  10. rate limiting   - cheap rejection before touching the database
 *  11. CSRF            - after cookies, before any handler mutates state
 *  12. routes
 *  13. 404 handler
 *  14. central error handler (must be last)
 */
export function createApp(): Express {
  const app = express();

  // Behind a proxy (Render, Nginx) the client IP is in X-Forwarded-For. Only
  // trust it when explicitly configured; otherwise a client could spoof the
  // header and bypass the per-IP rate limits.
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---- 1. request id ----
  app.use(requestId);

  // ---- 2. request logging ----
  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req as { id?: string }).id ?? 'unknown',
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        // Only the fields we actually need: no headers, no bodies, so cookies,
        // tokens and passwords cannot reach the log sink by accident.
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }

  // ---- 3. helmet (strict CSP) ----
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          // Swagger UI ships its own inline styles; without this the dev docs
          // page renders unstyled. No equivalent relaxation for scripts.
          styleSrc: isDevelopment ? ["'self'", "'unsafe-inline'"] : ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", env.CLIENT_URL],
          formAction: ["'self'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );

  // ---- 4. CORS: the configured client only, with credentials ----
  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin and server-to-server calls arrive without an Origin.
        if (!origin || origin === env.CLIENT_URL) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', CSRF_HEADER, REQUEST_ID_HEADER, 'Authorization'],
      exposedHeaders: [REQUEST_ID_HEADER],
      maxAge: 600,
    }),
  );

  // ---- 5. compression ----
  app.use(compression());

  // ---- 6. body parsing, 100 kb cap ----
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // ---- 7. cookies ----
  app.use(cookieParser());

  // ---- 8. NoSQL injection: strip $ and . from keys ----
  app.use(mongoSanitize({ replaceWith: '_' }));

  // ---- 9. HTTP parameter pollution ----
  app.use(hpp());

  // ---- 10. global rate limit ----
  app.use(API_PREFIX, generalLimiter);

  // ---- listing photos: public, read-only, no CSRF needed for a GET ----
  app.use(
    `${API_PREFIX}/uploads`,
    express.static(path.resolve(__dirname, '../', env.UPLOAD_DIR), {
      maxAge: isProduction ? '7d' : 0,
      index: false,
    }),
  );

  // ---- API docs: development only, mounted before CSRF so the UI loads ----
  if (isDevelopment) {
    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        customSiteTitle: 'FarmFair API',
        swaggerOptions: { persistAuthorization: true, withCredentials: true },
      }),
    );
    app.get('/api/docs.json', (_req, res) => {
      res.json(openApiDocument);
    });
  }

  // ---- 11. CSRF on all state-changing requests ----
  app.use(API_PREFIX, csrfProtection);

  // ---- 12. routes ----
  app.use(API_PREFIX, apiRouter);

  // ---- 13. 404 ----
  app.use(notFoundHandler);

  // ---- 14. central error handler ----
  app.use(errorHandler);

  return app;
}
