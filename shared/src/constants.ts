/**
 * Platform-wide constants shared by the server and the client.
 * Keep this file free of runtime dependencies so it can be imported anywhere.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = ['farmer', 'buyer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Roles a visitor may self-register as. Admins are created by CLI only. */
export const SELF_REGISTERABLE_ROLES = ['farmer', 'buyer'] as const;
export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number];

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export const LANGUAGES = ['en', 'ta'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  ta: 'தமிழ்',
};

// ---------------------------------------------------------------------------
// Verification (buyers must be approved before they can transact)
// ---------------------------------------------------------------------------

export const VERIFICATION_STATUSES = ['not_required', 'pending', 'approved', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Tamil Nadu districts (38, as of the 2022 reorganisation)
// ---------------------------------------------------------------------------

export const TN_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kancheepuram',
  'Kanniyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar',
] as const;
export type District = (typeof TN_DISTRICTS)[number];

export const DISTRICT_NAMES_TA: Partial<Record<District, string>> = {
  Salem: 'சேலம்',
  Namakkal: 'நாமக்கல்',
  Erode: 'ஈரோடு',
  Coimbatore: 'கோயம்புத்தூர்',
  Madurai: 'மதுரை',
  Tiruchirappalli: 'திருச்சிராப்பள்ளி',
  Chennai: 'சென்னை',
  Thanjavur: 'தஞ்சாவூர்',
  Dindigul: 'திண்டுக்கல்',
  Tiruppur: 'திருப்பூர்',
};

// ---------------------------------------------------------------------------
// Crops
//
// `key` is the stable identifier stored in the database. Display names are
// resolved for the UI; new crops can be appended without a migration.
// ---------------------------------------------------------------------------

export interface CropDefinition {
  key: string;
  en: string;
  ta: string;
  /** Unit the crop is traded in on the platform. */
  unit: 'kg';
}

export const CROPS: readonly CropDefinition[] = [
  { key: 'tomato', en: 'Tomato', ta: 'தக்காளி', unit: 'kg' },
  { key: 'onion', en: 'Onion', ta: 'வெங்காயம்', unit: 'kg' },
  { key: 'brinjal', en: 'Brinjal', ta: 'கத்தரிக்காய்', unit: 'kg' },
  { key: 'banana', en: 'Banana', ta: 'வாழை', unit: 'kg' },
  { key: 'coconut', en: 'Coconut', ta: 'தேங்காய்', unit: 'kg' },
  { key: 'turmeric', en: 'Turmeric', ta: 'மஞ்சள்', unit: 'kg' },
  { key: 'tapioca', en: 'Tapioca', ta: 'மரவள்ளிக்கிழங்கு', unit: 'kg' },
  { key: 'groundnut', en: 'Groundnut', ta: 'நிலக்கடலை', unit: 'kg' },
  { key: 'paddy', en: 'Paddy', ta: 'நெல்', unit: 'kg' },
  { key: 'chilli', en: 'Chilli', ta: 'மிளகாய்', unit: 'kg' },
  // --- room to extend: append below; never rename or remove existing keys ---
  { key: 'ladies_finger', en: 'Ladies Finger', ta: 'வெண்டைக்காய்', unit: 'kg' },
  { key: 'drumstick', en: 'Drumstick', ta: 'முருங்கைக்காய்', unit: 'kg' },
  { key: 'sugarcane', en: 'Sugarcane', ta: 'கரும்பு', unit: 'kg' },
  { key: 'maize', en: 'Maize', ta: 'மக்காச்சோளம்', unit: 'kg' },
  { key: 'cotton', en: 'Cotton', ta: 'பருத்தி', unit: 'kg' },
];

export const CROP_KEYS: readonly string[] = CROPS.map((c) => c.key);

const CROP_BY_KEY = new Map(CROPS.map((c) => [c.key, c]));

export function getCrop(key: string): CropDefinition | undefined {
  return CROP_BY_KEY.get(key);
}

export function getCropName(key: string, language: Language = DEFAULT_LANGUAGE): string {
  const crop = CROP_BY_KEY.get(key);
  if (!crop) return key;
  return language === 'ta' ? crop.ta : crop.en;
}

export function isCropKey(key: string): boolean {
  return CROP_BY_KEY.has(key);
}

// ---------------------------------------------------------------------------
// Grades
// ---------------------------------------------------------------------------

export const GRADES = ['A', 'B', 'C'] as const;
export type Grade = (typeof GRADES)[number];

export interface GradeDefinition {
  key: Grade;
  label: { en: string; ta: string };
  description: { en: string; ta: string };
}

export const GRADE_DEFINITIONS: readonly GradeDefinition[] = [
  {
    key: 'A',
    label: { en: 'Grade A', ta: 'தரம் A' },
    description: {
      en: 'Premium - uniform size, no blemishes, fresh, retail or export quality.',
      ta: 'உயர் தரம் - சீரான அளவு, கறைகள் இல்லை, புதிய, சில்லறை தரம்.',
    },
  },
  {
    key: 'B',
    label: { en: 'Grade B', ta: 'தரம் B' },
    description: {
      en: 'Standard - mixed sizes, minor marks, good for local markets.',
      ta: 'சாதாரண தரம் - கலந்த அளவுகள், சிறிய கறைகள், உள்ளூர் சந்தைக்கு ஏற்றது.',
    },
  },
  {
    key: 'C',
    label: { en: 'Grade C', ta: 'தரம் C' },
    description: {
      en: 'Basic - small or irregular, visible marks, suited to processing.',
      ta: 'அடிப்படை தரம் - சிறிய அல்லது ஒழுங்கற்ற, கறைகள் தெரியும், பதப்படுத்தலுக்கு ஏற்றது.',
    },
  },
];

const GRADE_BY_KEY = new Map(GRADE_DEFINITIONS.map((g) => [g.key, g]));

export function getGrade(key: string): GradeDefinition | undefined {
  return GRADE_BY_KEY.get(key as Grade);
}

// ---------------------------------------------------------------------------
// Auth / security limits
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;
/** argon2 and bcrypt both stop consuming input around 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

export const MAX_FAILED_LOGINS = 5;
export const ACCOUNT_LOCK_MINUTES = 15;

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL = '7d';

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

export const CSRF_HEADER = 'x-csrf-token';
export const CSRF_COOKIE = 'ff_csrf';
export const ACCESS_COOKIE = 'ff_access';
export const REFRESH_COOKIE = 'ff_refresh';
/** Refresh cookie is scoped so it is never sent to ordinary API routes. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

export const API_PREFIX = '/api/v1';

export const MAX_CROPS_PER_USER = 10;

// ---------------------------------------------------------------------------
// Mandi prices (Phase 2)
// ---------------------------------------------------------------------------

export const PRICE_TREND_DEFAULT_DAYS = 30;
export const PRICE_TREND_MAX_DAYS = 90;

/** A quoted price within this band of today's modal price counts as "fair". */
export const FAIR_PRICE_TOLERANCE_PERCENT = 5;

export const MANDI_PRICE_SOURCES = ['data_gov', 'generated'] as const;
export type MandiPriceSource = (typeof MANDI_PRICE_SOURCES)[number];

export const FAIR_PRICE_VERDICTS = ['below_market', 'fair', 'above_market'] as const;
export type FairPriceVerdict = (typeof FAIR_PRICE_VERDICTS)[number];

// ---------------------------------------------------------------------------
// Marketplace: listings and offers (Phase 3)
// ---------------------------------------------------------------------------

/**
 * `expired` is never set directly - a listing is `active` until it is
 * withdrawn, or until `expiresAt` passes, at which point it reads as expired
 * without a background job having to flip the stored value. `sold` is set
 * once one of its offers is accepted (Phase 4): a listing is one batch, sold
 * to one buyer, not a pool of inventory split across multiple deals.
 */
export const LISTING_STATUSES = ['active', 'withdrawn', 'expired', 'sold'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Accepting an offer (Phase 4) forms a deal and creates an Order. */
export const OFFER_STATUSES = ['pending', 'withdrawn', 'declined', 'accepted'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const MIN_LISTING_QUANTITY_KG = 1;
export const MAX_LISTING_QUANTITY_KG = 50_000;

export const MIN_PRICE_PER_KG = 0.5;
export const MAX_PRICE_PER_KG = 10_000;

export const OFFER_MESSAGE_MAX_LENGTH = 300;

export const MAX_PHOTO_SIZE_MB = 5;
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// ---------------------------------------------------------------------------
// Escrow orders (Phase 4)
// ---------------------------------------------------------------------------

/**
 * `pending_payment` - offer accepted, Order created, awaiting the buyer's
 * escrow payment.
 * `paid`            - money held in escrow; awaiting pickup confirmation
 *                      from both sides.
 * `completed`       - both farmer and buyer confirmed pickup; funds
 *                      released (simulated) to the farmer minus commission.
 * `cancelled`       - cancelled before payment; no money was ever involved.
 *                      Once `paid`, the only forward path is `completed`.
 */
export const ORDER_STATUSES = ['pending_payment', 'paid', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['simulated', 'razorpay'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_COMMENT_MAX_LENGTH = 300;

export const CANCEL_REASON_MAX_LENGTH = 300;

// ---------------------------------------------------------------------------
// Notifications and scheduled jobs (Phase 5)
// ---------------------------------------------------------------------------

/**
 * Every event the platform tells a user about. One notification type maps to
 * one template in `notifications/templates.ts` on the server.
 */
export const NOTIFICATION_TYPES = [
  'offer_created',
  'offer_declined',
  'offer_accepted',
  'order_paid',
  'order_completed',
  'order_cancelled',
  'rating_received',
  'listing_expired',
  'price_alert',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const JOB_NAMES = ['expireListings', 'priceAlerts', 'cleanup'] as const;
export type JobName = (typeof JOB_NAMES)[number];

export const JOB_RUN_STATUSES = ['running', 'success', 'failed'] as const;
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];
