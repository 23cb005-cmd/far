import { RATING_COMMENT_MAX_LENGTH, RATING_MAX, RATING_MIN } from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/** One party's rating of the other, left after an order completes. */
export interface RatingDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  rater: Types.ObjectId;
  ratee: Types.ObjectId;
  score: number;
  comment?: string;
  createdAt: Date;
}

export type RatingModel = Model<RatingDocument>;

const ratingSchema = new Schema<RatingDocument, RatingModel>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    rater: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ratee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    score: { type: Number, required: true, min: RATING_MIN, max: RATING_MAX },
    comment: { type: String, trim: true, maxlength: RATING_COMMENT_MAX_LENGTH },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One rating per rater per order - enforced here, not just in the service,
// so a race between two concurrent requests cannot produce two ratings.
ratingSchema.index({ order: 1, rater: 1 }, { unique: true });

export const Rating = model<RatingDocument, RatingModel>('Rating', ratingSchema);
