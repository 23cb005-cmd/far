import {
  MAX_LISTING_QUANTITY_KG,
  MAX_PRICE_PER_KG,
  MIN_LISTING_QUANTITY_KG,
  MIN_PRICE_PER_KG,
  OFFER_MESSAGE_MAX_LENGTH,
  OFFER_STATUSES,
  type OfferStatus,
} from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface OfferDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  listing: Types.ObjectId;
  buyer: Types.ObjectId;
  quantityKg: number;
  offeredPricePerKg: number;
  message?: string;
  /** Today's modal price for the listing's crop/district when the offer was made. */
  marketPriceAtOffer?: number;
  status: OfferStatus;
  declineReason?: string;
  /** Short reference a farmer can type back over WhatsApp (Phase 6), e.g. "ACCEPT TK4P9Q". */
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OfferModel = Model<OfferDocument>;

const offerSchema = new Schema<OfferDocument, OfferModel>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quantityKg: {
      type: Number,
      required: true,
      min: MIN_LISTING_QUANTITY_KG,
      max: MAX_LISTING_QUANTITY_KG,
    },
    offeredPricePerKg: {
      type: Number,
      required: true,
      min: MIN_PRICE_PER_KG,
      max: MAX_PRICE_PER_KG,
    },
    message: { type: String, trim: true, maxlength: OFFER_MESSAGE_MAX_LENGTH },
    marketPriceAtOffer: { type: Number, min: 0 },
    status: { type: String, enum: OFFER_STATUSES, default: 'pending' },
    declineReason: { type: String, trim: true, maxlength: OFFER_MESSAGE_MAX_LENGTH },
    code: { type: String, required: true, unique: true, uppercase: true },
  },
  { timestamps: true },
);

// Backs the farmer's "offers on this listing" view.
offerSchema.index({ listing: 1, createdAt: -1 });
// Backs the buyer's "my offers" view.
offerSchema.index({ buyer: 1, createdAt: -1 });

export const Offer = model<OfferDocument, OfferModel>('Offer', offerSchema);
