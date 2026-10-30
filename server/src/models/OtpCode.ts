import { OTP_MAX_ATTEMPTS, PHONE_E164_REGEX } from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export const OTP_PURPOSES = ['phone_verification'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export interface OtpCodeDocument extends Document<Types.ObjectId> {
  user: Types.ObjectId;
  phone: string;
  /** SHA-256 of the code. The plaintext code is never stored. */
  codeHash: string;
  purpose: OtpPurpose;
  attempts: number;
  consumedAt?: Date;
  expiresAt: Date;
  createdAt: Date;

  isExpired(): boolean;
  isExhausted(): boolean;
}

const otpCodeSchema = new Schema<OtpCodeDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, required: true, match: [PHONE_E164_REGEX, 'Invalid phone'] },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: OTP_PURPOSES, default: 'phone_verification' },
    attempts: { type: Number, default: 0, min: 0 },
    consumedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Mongo removes documents shortly after `expiresAt`; the application still
// checks expiry itself, because the TTL monitor only runs about once a minute.
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpCodeSchema.index({ user: 1, purpose: 1, createdAt: -1 });

otpCodeSchema.methods.isExpired = function isExpired(this: OtpCodeDocument): boolean {
  return this.expiresAt.getTime() <= Date.now();
};

otpCodeSchema.methods.isExhausted = function isExhausted(this: OtpCodeDocument): boolean {
  return this.attempts >= OTP_MAX_ATTEMPTS;
};

export type OtpCodeModel = Model<OtpCodeDocument>;

export const OtpCode = model<OtpCodeDocument>('OtpCode', otpCodeSchema);
