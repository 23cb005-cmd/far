import { z } from 'zod';
import {
  CROP_KEYS,
  LANGUAGES,
  MAX_CROPS_PER_USER,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  OTP_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SELF_REGISTERABLE_ROLES,
  TN_DISTRICTS,
} from '../constants';
import { isValidGstin, normaliseGstin } from '../utils/gst';
import { normalisePhone } from '../utils/phone';

// ---------------------------------------------------------------------------
// Primitive field schemas (reused across requests)
// ---------------------------------------------------------------------------

export const nameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(NAME_MIN_LENGTH, `Name must be at least ${NAME_MIN_LENGTH} characters`)
  .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`)
  // Latin letters, the Tamil block, spaces and the punctuation found in Indian names.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u, 'Name contains invalid characters');

/**
 * Accepts any common Indian mobile spelling and transforms it to `+91XXXXXXXXXX`.
 * Because this is a transform, parsed output is always canonical.
 */
export const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .min(1, 'Phone number is required')
  .transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (!normalised) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid 10-digit Indian mobile number',
      });
      return z.NEVER;
    }
    return normalised;
  });

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

// An `errorMap` rather than `required_error`/`invalid_type_error`: an empty
// select raises `invalid_enum_value`, which those two options do not cover, and
// Zod's default message for it lists all 38 districts back at the user.
export const districtSchema = z.enum(TN_DISTRICTS, {
  errorMap: () => ({ message: 'Select a valid Tamil Nadu district' }),
});

export const villageSchema = z.string().trim().max(80, 'Village must be at most 80 characters');

export const languageSchema = z.enum(LANGUAGES);

export const cropsSchema = z
  .array(z.string().refine((key) => CROP_KEYS.includes(key), { message: 'Unknown crop' }))
  .max(MAX_CROPS_PER_USER, `Select at most ${MAX_CROPS_PER_USER} crops`)
  // Duplicates are a client bug rather than a user error; de-duplicate silently.
  .transform((crops) => Array.from(new Set(crops)));

export const gstNumberSchema = z
  .string()
  .trim()
  .transform(normaliseGstin)
  .refine((value) => value === '' || isValidGstin(value), {
    message: 'Enter a valid 15-character GSTIN',
  });

export const businessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Business name must be at least 2 characters')
    .max(120, 'Business name must be at most 120 characters'),
  gstNumber: gstNumberSchema.optional(),
});

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    password: passwordSchema,
    role: z.enum(SELF_REGISTERABLE_ROLES, {
      errorMap: () => ({ message: 'Choose whether you are a farmer or a buyer' }),
    }),
    district: districtSchema,
    village: villageSchema.optional(),
    crops: cropsSchema.optional().default([]),
    language: languageSchema.optional().default('en'),
    business: businessSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'buyer' && !value.business?.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['business', 'name'],
        message: 'Business name is required for buyers',
      });
    }
    if (value.role === 'farmer' && (!value.crops || value.crops.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['crops'],
        message: 'Select at least one crop you grow',
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  phone: phoneSchema,
  // Deliberately not `passwordSchema`: policy failures here must not hint at
  // the stored password, and older passwords should still be able to sign in.
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Update profile
// ---------------------------------------------------------------------------

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    district: districtSchema.optional(),
    village: villageSchema.optional(),
    crops: cropsSchema.optional(),
    language: languageSchema.optional(),
    notifyWhatsApp: z.boolean().optional(),
    business: businessSchema.partial().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// OTP phone verification
// ---------------------------------------------------------------------------

export const otpSendSchema = z.object({
  /** Optional: defaults to the phone on the authenticated account. */
  phone: phoneSchema.optional(),
});

export type OtpSendInput = z.infer<typeof otpSendSchema>;

export const otpVerifySchema = z.object({
  code: z
    .string({ required_error: 'Enter the code we sent you' })
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
