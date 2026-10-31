import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ALLOWED_PHOTO_MIME_TYPES, API_PREFIX, MAX_PHOTO_SIZE_MB } from '@farmfair/shared';
import multer from 'multer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Only `local` is implemented. Cloudinary and S3 are reserved for a later
 * phase - until then any other value falls back to local disk, matching how
 * the Phase 1 OTP provider handles an unimplemented choice.
 */
if (env.STORAGE_PROVIDER !== 'local') {
  logger.warn(
    `STORAGE_PROVIDER=${env.STORAGE_PROVIDER} is not implemented yet; using local disk storage`,
  );
}

const uploadRoot = path.resolve(__dirname, '../../', env.UPLOAD_DIR, 'listings');
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadRoot,
  filename: (_req, file, callback) => {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? '.jpg';
    callback(null, `${randomUUID()}${extension}`);
  },
});

/** Single-file upload for a listing photo, field name `photo`. */
export const listingPhotoUpload = multer({
  storage,
  limits: { fileSize: MAX_PHOTO_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!(ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(AppError.badRequest('Photo must be a JPEG, PNG or WebP image'));
      return;
    }
    callback(null, true);
  },
}).single('photo');

/** Public URL for a file multer has already written to `uploadRoot`. */
export function listingPhotoUrl(filename: string): string {
  return `${API_PREFIX}/uploads/listings/${filename}`;
}

export { uploadRoot };
