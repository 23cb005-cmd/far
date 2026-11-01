import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/**
 * Debug log of inbound WhatsApp messages, kept only long enough to diagnose
 * a bad bot reply - not a transcript, so the phone is masked before it is
 * ever written here (never the raw number, even in this internal log).
 */
export interface InboundMessageDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  phone: string;
  body: string;
  messageSid: string;
  outcome: string;
  createdAt: Date;
}

export type InboundMessageModel = Model<InboundMessageDocument>;

const inboundMessageSchema = new Schema<InboundMessageDocument, InboundMessageModel>(
  {
    phone: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    messageSid: { type: String, required: true, unique: true },
    outcome: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Backs the admin "recent bot messages" view.
inboundMessageSchema.index({ createdAt: -1 });

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
inboundMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });

export const InboundMessage = model<InboundMessageDocument, InboundMessageModel>(
  'InboundMessage',
  inboundMessageSchema,
);
