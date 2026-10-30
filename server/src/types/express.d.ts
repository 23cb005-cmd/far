import type { Role } from '@farmfair/shared';

/** The identity attached by `requireAuth`. */
export interface AuthContext {
  userId: string;
  role: Role;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      /** Correlation id set by the requestId middleware. */
      id: string;
      /** Present only after `requireAuth` (or `optionalAuth`) has run. */
      auth?: AuthContext;
    }
  }
}

export {};
