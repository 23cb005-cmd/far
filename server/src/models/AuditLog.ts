import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/**
 * Append-only record of security- and money-relevant actions.
 *
 * Entries are written on a best-effort basis: a failure to audit must never
 * fail the user action that triggered it (see `services/audit.ts`).
 */
export const AUDIT_ACTIONS = [
  'auth.register',
  'auth.login.success',
  'auth.login.failure',
  'auth.login.locked',
  'auth.logout',
  'auth.refresh',
  'auth.password.change',
  'auth.profile.update',
  'auth.otp.send',
  'auth.otp.verify',
  'admin.create',
  'admin.job.run',
  'admin.user.verify',
  'admin.user.suspend',
  'admin.user.unsuspend',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number] | (string & {});

export const AUDIT_CHANNELS = ['web', 'whatsapp', 'telegram', 'cli', 'system'] as const;
export type AuditChannel = (typeof AUDIT_CHANNELS)[number];

export interface AuditLogDocument extends Document<Types.ObjectId> {
  /** Null for anonymous or failed-login attempts where no user was resolved. */
  actor?: Types.ObjectId | null;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  channel: AuditChannel;
  requestId?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, trim: true },
    entityId: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 300 },
    channel: { type: String, enum: AUDIT_CHANNELS, default: 'web' },
    requestId: { type: String, trim: true },
  },
  {
    // Audit entries are never modified, so only a creation timestamp is kept.
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false,
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

/**
 * Optional retention: entries expire after two years. Comment the index out (or
 * raise the value) where a longer financial audit trail is required.
 */
const TWO_YEARS_SECONDS = 60 * 60 * 24 * 730;
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: TWO_YEARS_SECONDS });

export type AuditLogModel = Model<AuditLogDocument>;

export const AuditLog = model<AuditLogDocument>('AuditLog', auditLogSchema);
