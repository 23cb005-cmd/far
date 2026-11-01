import { NOTIFICATION_TYPES, type NotificationType } from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/** One in-app alert for one user, optionally also sent over WhatsApp. */
export interface NotificationDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  /** Ids a client can use to link to the related listing/offer/order. */
  data?: Record<string, string | number>;
  whatsappSent: boolean;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export type NotificationModel = Model<NotificationDocument>;

const notificationSchema = new Schema<NotificationDocument, NotificationModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed },
    // Only ever set when NOTIFY_PROVIDER resolves to a real transport; the
    // console provider never flips this, so "sent" means sent for real.
    whatsappSent: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Backs the bell dropdown and the notifications page: a user's own feed, newest first.
notificationSchema.index({ user: 1, createdAt: -1 });
// Backs the unread-count badge.
notificationSchema.index({ user: 1, read: 1 });

export const Notification = model<NotificationDocument, NotificationModel>(
  'Notification',
  notificationSchema,
);
