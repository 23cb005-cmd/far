import type { Role, UserDto } from '@farmfair/shared';
import { create } from 'zustand';

interface AuthState {
  user: UserDto | null;
  /** True until the first `/auth/me` check resolves, so routes do not flash. */
  initialising: boolean;
  setUser: (user: UserDto | null) => void;
  setInitialising: (value: boolean) => void;
  clear: () => void;
}

/**
 * Holds the signed-in user.
 *
 * Deliberately not persisted to localStorage: the session lives in httpOnly
 * cookies, and a stale copy of the user in storage would let the UI show a
 * signed-in shell for a session the server has already revoked.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialising: true,
  setUser: (user) => set({ user, initialising: false }),
  setInitialising: (initialising) => set({ initialising }),
  clear: () => set({ user: null, initialising: false }),
}));

// ---- selectors ----

export const useUser = (): UserDto | null => useAuthStore((state) => state.user);

export const useIsAuthenticated = (): boolean => useAuthStore((state) => state.user !== null);

export const useRole = (): Role | null => useAuthStore((state) => state.user?.role ?? null);

/** Buyers must be approved before they can make offers (Phase 3). */
export const useIsPendingBuyer = (): boolean =>
  useAuthStore(
    (state) => state.user?.role === 'buyer' && state.user.verificationStatus === 'pending',
  );

/** The dashboard a user lands on after signing in. */
export function homePathFor(role: Role | null | undefined): string {
  switch (role) {
    case 'farmer':
      return '/app/farmer';
    case 'buyer':
      return '/app/buyer';
    case 'admin':
      return '/app/admin';
    default:
      return '/';
  }
}
