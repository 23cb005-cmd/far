import type { ApiResponse, PageMeta, Paginated } from '@farmfair/shared';
import type { Response } from 'express';

/** Send a successful envelope. Status defaults to 200. */
export function sendSuccess<T>(res: Response, data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data };
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/** Send a failure envelope. Prefer throwing an AppError over calling this. */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiResponse<never> = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return res.status(status).json(body);
}

export function buildPageMeta(page: number, limit: number, total: number): PageMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function paginated<T>(items: T[], page: number, limit: number, total: number): Paginated<T> {
  return { items, meta: buildPageMeta(page, limit, total) };
}
