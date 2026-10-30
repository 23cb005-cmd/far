import type { HealthResponse } from '@farmfair/shared';
import { Router } from 'express';
import { env } from '../config/env';
import { dbName, dbStatus } from '../config/db';
import { sendSuccess } from '../utils/respond';
import { version } from '../version';

export const healthRouter = Router();

/**
 * GET /api/v1/health
 *
 * Used by the local dev scripts and by the hosting platform's health check.
 * Reports `degraded` (still 200) when the process is up but the database is
 * not reachable, so a load balancer keeps the instance while an operator
 * investigates rather than cycling it.
 */
healthRouter.get('/', (_req, res) => {
  const status = dbStatus();
  const body: HealthResponse = {
    status: status === 'connected' ? 'ok' : 'degraded',
    version,
    uptimeSeconds: Math.round(process.uptime()),
    environment: env.NODE_ENV,
    db: { status, ...(dbName() ? { name: dbName() } : {}) },
    timestamp: new Date().toISOString(),
  };
  sendSuccess(res, body);
});
