import { ERROR_CODES, MAX_PHOTO_SIZE_MB } from '@farmfair/shared';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { logger } from '../config/logger';
import { AppError, isAppError } from '../utils/AppError';
import { sendError } from '../utils/respond';
import { zodIssues } from './validate';

/** 404 for anything that reached the end of the router stack. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Cannot ${req.method} ${req.path}`));
}

interface Normalised {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Extract the duplicated field from a Mongo E11000 message or keyPattern. */
function duplicateKeyField(error: mongoose.mongo.MongoServerError): string | undefined {
  const pattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
  if (pattern) {
    const [field] = Object.keys(pattern);
    if (field) return field;
  }
  const match = /index:\s+(?:.*\$)?([\w.]+)_\d/.exec(error.message);
  return match?.[1];
}

function normalise(error: unknown): Normalised {
  if (isAppError(error)) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // Zod errors thrown outside the validate() middleware (e.g. in a service).
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: zodIssues(error),
    };
  }

  // Mongoose schema validation.
  if (error instanceof mongoose.Error.ValidationError) {
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: Object.values(error.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    };
  }

  // Upload rejected by multer (wrong field, too large, too many files).
  if (error instanceof multer.MulterError) {
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? `Photo must be smaller than ${MAX_PHOTO_SIZE_MB} MB`
          : 'Could not process the uploaded file',
    };
  }

  // Bad ObjectId in a path we did not validate.
  if (error instanceof mongoose.Error.CastError) {
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Invalid identifier',
      details: [{ path: error.path, message: 'Malformed id' }],
    };
  }

  // Unique index violation.
  if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
    const mongoError = error as mongoose.mongo.MongoServerError;
    const field = duplicateKeyField(mongoError);
    return {
      status: 409,
      code: ERROR_CODES.DUPLICATE_KEY,
      message: field
        ? `That ${field === 'phone' ? 'phone number' : field} is already registered`
        : 'That value is already in use',
      details: field ? [{ path: field, message: 'Already in use' }] : undefined,
    };
  }

  // Body parser failures.
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { type?: string; status?: number; statusCode?: number };
    if (candidate.type === 'entity.too.large') {
      return {
        status: 413,
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: 'Request body is too large',
      };
    }
    if (candidate.type === 'entity.parse.failed') {
      return {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request body is not valid JSON',
      };
    }
  }

  return {
    status: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Something went wrong',
  };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const { status, code, message, details } = normalise(error);

  const logPayload = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    userId: req.auth?.userId,
    err:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
  };

  if (status >= 500) {
    logger.error(logPayload, 'Unhandled request error');
  } else {
    // Expected failures (validation, auth) are noise at error level.
    logger.warn({ ...logPayload, err: undefined }, message);
  }

  // Stack traces and internal messages never cross the wire in production.
  const publicMessage =
    status >= 500 && isProduction ? 'Something went wrong. Please try again.' : message;

  const publicDetails = isProduction && status >= 500 ? undefined : details;

  if (res.headersSent) {
    res.end();
    return;
  }

  sendError(res, status, code, publicMessage, publicDetails);
};
