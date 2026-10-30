import { maskPhone } from '@farmfair/shared';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { logger } from '../config/logger';
import { AuditLog, type AuditAction, type AuditChannel } from '../models/AuditLog';

export interface AuditInput {
  actor?: string | Types.ObjectId | null;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  channel?: AuditChannel;
  req?: Request;
}

/** Keys whose values are masked before being written to the audit trail. */
const PHONE_KEYS = new Set(['phone', 'to', 'from']);

function sanitiseMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (PHONE_KEYS.has(key) && typeof value === 'string') {
      out[key] = maskPhone(value);
    } else if (/password|token|secret|code/i.test(key)) {
      // Never persist credentials, even accidentally.
      continue;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function clientIp(req?: Request): string | undefined {
  if (!req) return undefined;
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}

/**
 * Write an audit entry.
 *
 * Deliberately never throws: losing an audit line is bad, but failing a user's
 * login because the audit insert timed out is worse. Failures are logged at
 * error level so they are visible in monitoring.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actor:
        input.actor && Types.ObjectId.isValid(String(input.actor))
          ? new Types.ObjectId(String(input.actor))
          : null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: sanitiseMetadata(input.metadata),
      ip: clientIp(input.req),
      userAgent: input.req?.header('user-agent')?.slice(0, 300),
      channel: input.channel ?? 'web',
      requestId: input.req?.id,
    });
  } catch (error) {
    logger.error(
      { err: (error as Error).message, action: input.action },
      'Failed to write audit log entry',
    );
  }
}
