import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attaches a stable id to every request so a log line, an error response and a
 * support ticket can be correlated. An upstream proxy id is reused when it
 * looks sane; otherwise a fresh UUID is generated.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && /^[\w-]{8,128}$/.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
