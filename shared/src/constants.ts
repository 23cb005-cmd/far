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
