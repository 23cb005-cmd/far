import {
  CROP_KEYS,
  GRADES,
  LISTING_STATUSES,
  MAX_LISTING_QUANTITY_KG,
  MAX_PRICE_PER_KG,
  MIN_LISTING_QUANTITY_KG,
  MIN_PRICE_PER_KG,
  TN_DISTRICTS,
  type Grade,
  type ListingStatus,
} from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface ListingDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  farmer: Types.ObjectId;
  cropKey: string;
  grade: Grade;
  quantityKg: number;
  pricePerKg: number;
  readyDate: Date;
  /** Snapshot of the farmer's district at creation, so browsing never needs a join. */
  district: string;
  photoUrl?: string;
  status: ListingStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;

  /** `active` reads as `expired` once `expiresAt` passes, with no background job needed. */
  effectiveStatus(): ListingStatus;
}

export type ListingModel = Model<ListingDocument>;

const listingSchema = new Schema<ListingDocument, ListingModel>(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cropKey: {
      type: String,
      required: true,
      validate: {
        validator: (key: string) => CROP_KEYS.includes(key),
        message: 'Unknown crop',
      },
    },
    grade: { type: String, enum: GRADES, required: true },
    quantityKg: {
      type: Number,
      required: true,
      min: MIN_LISTING_QUANTITY_KG,
      max: MAX_LISTING_QUANTITY_KG,
    },
    pricePerKg: { type: Number, required: true, min: MIN_PRICE_PER_KG, max: MAX_PRICE_PER_KG },
    readyDate: { type: Date, required: true },
    district: { type: String, required: true, enum: TN_DISTRICTS },
    photoUrl: { type: String, trim: true },
    status: { type: String, enum: LISTING_STATUSES, default: 'active' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Backs the browse endpoint: active listings in a district/crop, newest first.
listingSchema.index({ status: 1, district: 1, cropKey: 1, createdAt: -1 });
// Backs the farmer's "my listings" view.
listingSchema.index({ farmer: 1, createdAt: -1 });
// A background sweep (later phase) would use this to flip stale listings.
listingSchema.index({ status: 1, expiresAt: 1 });

listingSchema.methods.effectiveStatus = function effectiveStatus(
  this: ListingDocument,
): ListingStatus {
  if (this.status === 'active' && this.expiresAt.getTime() <= Date.now()) return 'expired';
  return this.status;
};

export const Listing = model<ListingDocument, ListingModel>('Listing', listingSchema);
