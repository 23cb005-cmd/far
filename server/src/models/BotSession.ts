import { PHONE_E164_REGEX } from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/** Actions the bot is waiting on a YES/NO reply to confirm. */
export const BOT_PENDING_ACTIONS = [
  'sell_confirm',
  'accept_confirm',
  'confirm_order_confirm',
] as const;
export type BotPendingAction = (typeof BOT_PENDING_ACTIONS)[number];

/**
 * Per-phone conversation state, so a bare "YES" a few seconds after a
 * SELL/ACCEPT/CONFIRM command knows what it is confirming. One session per
 * phone; a new command overwrites whatever was pending before it.
 */
export interface BotSessionDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  phone: string;
  pendingAction: BotPendingAction;
  payload: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type BotSessionModel = Model<BotSessionDocument>;

const botSessionSchema = new Schema<BotSessionDocument, BotSessionModel>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [PHONE_E164_REGEX, 'Invalid phone'],
    },
    pendingAction: { type: String, enum: BOT_PENDING_ACTIONS, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Mongo removes the session once it expires; callers must not rely on timing
// more precisely than "about a minute", same caveat as `OtpCode`.
botSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const BotSession = model<BotSessionDocument, BotSessionModel>(
  'BotSession',
  botSessionSchema,
);
