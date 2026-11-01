import {
  CANCEL_REASON_MAX_LENGTH,
  CROP_KEYS,
  MAX_LISTING_QUANTITY_KG,
  MAX_PRICE_PER_KG,
  MIN_LISTING_QUANTITY_KG,
  MIN_PRICE_PER_KG,
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  type OrderStatus,
  type PaymentProviderName,
} from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/**
 * A deal formed by accepting an offer.
 *
 * `quantityKg`, `pricePerKg` and the commission figures are a snapshot taken
 * at acceptance: the listing or the farmer's configuration can change later
 * without altering a deal already in progress.
 */
export interface OrderDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  listing: Types.ObjectId;
  offer: Types.ObjectId;
  farmer: Types.ObjectId;
  buyer: Types.ObjectId;
  cropKey: string;
  quantityKg: number;
  pricePerKg: number;
  totalAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  payoutAmount: number;
  status: OrderStatus;
  paymentProvider?: PaymentProviderName;
  /** Provider's own reference for the escrow payment, where one exists. */
  paymentReference?: string;
  paidAt?: Date;
  farmerConfirmedAt?: Date;
  buyerConfirmedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;

  /** Pickup is confirmed once both sides have confirmed. */
  isFullyConfirmed(): boolean;
}

export type OrderModel = Model<OrderDocument>;

const orderSchema = new Schema<OrderDocument, OrderModel>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    offer: { type: Schema.Types.ObjectId, ref: 'Offer', required: true, unique: true },
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cropKey: {
      type: String,
      required: true,
      validate: {
        validator: (key: string) => CROP_KEYS.includes(key),
        message: 'Unknown crop',
      },
    },
    quantityKg: {
      type: Number,
      required: true,
      min: MIN_LISTING_QUANTITY_KG,
      max: MAX_LISTING_QUANTITY_KG,
    },
    pricePerKg: { type: Number, required: true, min: MIN_PRICE_PER_KG, max: MAX_PRICE_PER_KG },
    totalAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 20 },
    commissionAmount: { type: Number, required: true, min: 0 },
    payoutAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending_payment', index: true },
    paymentProvider: { type: String, enum: PAYMENT_PROVIDERS },
    paymentReference: { type: String, trim: true },
    paidAt: { type: Date },
    farmerConfirmedAt: { type: Date },
    buyerConfirmedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, maxlength: CANCEL_REASON_MAX_LENGTH },
  },
  { timestamps: true },
);

// Backs "my orders" for both roles, newest first.
orderSchema.index({ farmer: 1, createdAt: -1 });
orderSchema.index({ buyer: 1, createdAt: -1 });

orderSchema.methods.isFullyConfirmed = function isFullyConfirmed(this: OrderDocument): boolean {
  return Boolean(this.farmerConfirmedAt && this.buyerConfirmedAt);
};

export const Order = model<OrderDocument, OrderModel>('Order', orderSchema);
