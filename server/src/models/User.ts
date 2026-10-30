import {
  CROP_KEYS,
  GSTIN_REGEX,
  LANGUAGES,
  MAX_CROPS_PER_USER,
  PHONE_E164_REGEX,
  ROLES,
  TN_DISTRICTS,
  VERIFICATION_STATUSES,
  isValidGstin,
  type Language,
  type PublicUserDto,
  type Role,
  type UserDto,
  type VerificationStatus,
} from '@farmfair/shared';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface UserBusiness {
  name?: string;
  gstNumber?: string;
}

export interface UserDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  passwordHash: string;
  role: Role;
  district: string;
  village?: string;
  crops: string[];
  language: Language;
  business?: UserBusiness;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  isSuspended: boolean;
  suspensionReason?: string;
  notifyWhatsApp: boolean;
  phoneVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  /** Bumped on logout, password change and suspension to invalidate all tokens. */
  tokenVersion: number;
  failedLoginCount: number;
  lockUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // instance methods
  isLocked(): boolean;
  toPublicJSON(): PublicUserDto;
}

export interface UserModel extends Model<UserDocument> {
  findByPhone(phone: string): Promise<UserDocument | null>;
}

const businessSchema = new Schema<UserBusiness>(
  {
    name: { type: String, trim: true, maxlength: 120 },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        // Buyers may register before they have a GSTIN, so empty is allowed;
        // anything present must be structurally valid including the checksum.
        validator: (value: string) => !value || isValidGstin(value),
        message: 'Enter a valid 15-character GSTIN',
      },
      match: [GSTIN_REGEX, 'Enter a valid 15-character GSTIN'],
    },
  },
  { _id: false },
);

const userSchema = new Schema<UserDocument, UserModel>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      match: [PHONE_E164_REGEX, 'Phone must be stored as +91XXXXXXXXXX'],
    },
    passwordHash: { type: String, required: true, select: true },
    role: { type: String, required: true, enum: ROLES, index: true },
    district: { type: String, required: true, enum: TN_DISTRICTS, index: true },
    village: { type: String, trim: true, maxlength: 80 },
    crops: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (crops: string[]) => crops.length <= MAX_CROPS_PER_USER,
          message: `Select at most ${MAX_CROPS_PER_USER} crops`,
        },
        {
          validator: (crops: string[]) => crops.every((c) => CROP_KEYS.includes(c)),
          message: 'Unknown crop',
        },
      ],
    },
    language: { type: String, enum: LANGUAGES, default: 'en' },
    business: { type: businessSchema, default: undefined },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: 'not_required',
      index: true,
    },
    verificationNote: { type: String, trim: true, maxlength: 500 },
    isSuspended: { type: Boolean, default: false, index: true },
    suspensionReason: { type: String, trim: true, maxlength: 500 },
    notifyWhatsApp: { type: Boolean, default: true },
    phoneVerified: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    tokenVersion: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        // Secrets and internal security state must never leave the server,
        // regardless of which route serialised the document.
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.failedLoginCount;
        delete ret.lockUntil;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// Compound index backing the admin verification queue.
userSchema.index({ role: 1, verificationStatus: 1, createdAt: -1 });
// Used by the Phase 5 price-alert fan-out (farmers growing crop X in district Y).
userSchema.index({ role: 1, district: 1, crops: 1 });

/** Farmers never need verification; buyers always start pending. */
userSchema.pre('validate', function assignVerificationDefault(next) {
  if (this.isNew) {
    if (this.role === 'buyer' && this.verificationStatus === 'not_required') {
      this.verificationStatus = 'pending';
    }
    if (this.role !== 'buyer' && this.verificationStatus === 'pending') {
      this.verificationStatus = 'not_required';
    }
  }
  next();
});

/** Buyers must identify their business; a GSTIN is optional but validated. */
userSchema.pre('validate', function requireBusinessForBuyers(next) {
  if (this.role === 'buyer' && !this.business?.name) {
    this.invalidate('business.name', 'Business name is required for buyers');
  }
  next();
});

userSchema.methods.isLocked = function isLocked(this: UserDocument): boolean {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

userSchema.methods.toPublicJSON = function toPublicJSON(this: UserDocument): PublicUserDto {
  return {
    id: String(this._id),
    name: this.name,
    role: this.role,
    district: this.district,
    ...(this.village ? { village: this.village } : {}),
    ...(this.business?.name ? { businessName: this.business.name } : {}),
    verified: this.verificationStatus === 'approved' || this.role === 'farmer',
    ratingAvg: this.ratingAvg,
    ratingCount: this.ratingCount,
    memberSince: this.createdAt.toISOString(),
  };
};

userSchema.statics.findByPhone = function findByPhone(this: UserModel, phone: string) {
  return this.findOne({ phone }).exec();
};

/** Typed view of the owner-facing serialisation produced by `toJSON`. */
export function toUserDto(user: UserDocument): UserDto {
  const json = user.toJSON() as unknown as UserDto;
  return json;
}

export const User = model<UserDocument, UserModel>('User', userSchema);
