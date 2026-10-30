import { ERROR_CODES, type FieldIssue } from '@farmfair/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function zodIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validates and *replaces* the request parts with the parsed result, so
 * downstream handlers only ever see coerced, trimmed, known fields. Unknown
 * keys are stripped by Zod object schemas, which means a client cannot smuggle
 * extra properties into a Mongoose update.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as Request['params'];
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as Request['query'];
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          AppError.badRequest('Validation failed', zodIssues(error), ERROR_CODES.VALIDATION_ERROR),
        );
        return;
      }
      next(error);
    }
  };
}
