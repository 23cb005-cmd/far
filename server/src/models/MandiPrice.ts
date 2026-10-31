import {
  CROP_KEYS,
  MANDI_PRICE_SOURCES,
  TN_DISTRICTS,
  type MandiPriceSource,
} from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/**
 * One market's reported price for one crop on one day.
 *
 * `date` is stored as `YYYY-MM-DD` (not a `Date`) so range queries, grouping
 * and the unique index are all plain string comparisons - no timezone drift
 * between the server, Mongo and the external API's own date formatting.
 */
export interface MandiPriceDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  date: string;
  district: string;
  cropKey: string;
  market: string;
  variety?: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  unit: 'kg';
  source: MandiPriceSource;
  createdAt: Date;
}

export type MandiPriceModel = Model<MandiPriceDocument>;

const mandiPriceSchema = new Schema<MandiPriceDocument, MandiPriceModel>(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    district: { type: String, required: true, enum: TN_DISTRICTS },
    cropKey: {
      type: String,
      required: true,
      validate: {
        validator: (key: string) => CROP_KEYS.includes(key),
        message: 'Unknown crop',
      },
    },
    market: { type: String, required: true, trim: true, maxlength: 120 },
    variety: { type: String, trim: true, maxlength: 80 },
    minPrice: { type: Number, required: true, min: 0 },
    maxPrice: { type: Number, required: true, min: 0 },
    modalPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['kg'], default: 'kg' },
    source: { type: String, enum: MANDI_PRICE_SOURCES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One record per market per crop per day; re-ingesting the same day upserts
// rather than duplicating rows.
mandiPriceSchema.index({ date: 1, district: 1, cropKey: 1, market: 1 }, { unique: true });
// Backs the trend query: all days for one district+crop, oldest to newest.
mandiPriceSchema.index({ district: 1, cropKey: 1, date: 1 });

export const MandiPrice = model<MandiPriceDocument, MandiPriceModel>(
  'MandiPrice',
  mandiPriceSchema,
);
