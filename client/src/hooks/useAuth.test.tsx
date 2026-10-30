import { renderHook } from '@testing-library/react';
import type * as ReactRouterModule from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserDto } from '@farmfair/shared';
import { useAuthStore } from '@/store/auth';

type ReactRouter = typeof ReactRouterModule;

const navigate = vi.fn();
let expiredHandler: (() => void) | null = null;

vi.mock('@/lib/api', () => ({
  setSessionExpiredHandler: (handler: (() => void) | null) => {
    expiredHandler = handler;
  },
  ApiRequestError: class extends Error {},
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<ReactRouter>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const { useSessionExpiryRedirect } = await import('./useAuth');

const signedInUser = {
  id: '1',
  name: 'Murugan S',
  phone: '+919876543210',
  role: 'farmer',
  district: 'Salem',
  crops: ['tomato'],
  language: 'en',
  verificationStatus: 'not_required',
  isSuspended: false,
  notifyWhatsApp: true,
  phoneVerified: false,
  ratingAvg: 0,
  ratingCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as UserDto;

function mount() {
  renderHook(() => useSessionExpiryRedirect(), { wrapper: MemoryRouter });
}

describe('useSessionExpiryRedirect', () => {
  beforeEach(() => {
    navigate.mockReset();
    expiredHandler = null;
    useAuthStore.setState({ user: null, initialising: true });
  });

  it('redirects a signed-in user whose session has ended', () => {
    useAuthStore.setState({ user: signedInUser, initialising: false });
    mount();

    expiredHandler?.();

    expect(navigate).toHaveBeenCalledWith('/login?expired=1', { replace: true });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('leaves an anonymous visitor alone', () => {
    // A 401 is also the normal answer to the bootstrap /auth/me call for a
    // logged-out visitor. Redirecting them off the public landing page with
    // "your session ended" would be both wrong and alarming.
    mount();

    expiredHandler?.();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect twice if the handler fires again after signing out', () => {
    useAuthStore.setState({ user: signedInUser, initialising: false });
    mount();

    expiredHandler?.();
    expect(navigate).toHaveBeenCalledTimes(1);

    // Several in-flight requests can each get a 401 at once.
    expiredHandler?.();
    expiredHandler?.();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
