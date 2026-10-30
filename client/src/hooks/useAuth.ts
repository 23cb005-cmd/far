import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserDto,
} from '@farmfair/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { type ApiRequestError, setSessionExpiredHandler } from '@/lib/api';
import { authApi } from '@/lib/authApi';
import { setLanguage } from '@/lib/i18n';
import { homePathFor, useAuthStore } from '@/store/auth';

/**
 * Restore the session on first load.
 *
 * `/auth/me` is the only source of truth for who is signed in: the session
 * itself lives in httpOnly cookies the JavaScript cannot read, so the app has
 * to ask. A 401 here is the normal answer for a visitor, not an error.
 */
export function useAuthBootstrap(): { initialising: boolean } {
  const { setUser, clear, initialising } = useAuthStore();

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const user = await authApi.me();
        if (!cancelled) {
          setUser(user);
          // Honour the language saved on the account over the local default.
          setLanguage(user.language);
        }
      } catch {
        if (!cancelled) clear();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setUser, clear]);

  return { initialising };
}

/**
 * Wire the axios interceptor so an expired session clears state and redirects.
 *
 * The redirect only fires when someone was actually signed in. A 401 is also
 * the normal answer to the bootstrap `/auth/me` call for an anonymous visitor,
 * and bouncing them off the public landing page with "your session ended"
 * would be both wrong and alarming.
 */
export function useSessionExpiryRedirect(): void {
  const navigate = useNavigate();

  React.useEffect(() => {
    setSessionExpiredHandler(() => {
      // Read through the store rather than a hook value, so the handler always
      // sees current state instead of a closed-over snapshot.
      const { user, clear } = useAuthStore.getState();
      if (!user) return;

      clear();
      // `replace` so the back button does not return to a dead authed page.
      navigate('/login?expired=1', { replace: true });
    });
    return () => setSessionExpiredHandler(null);
  }, [navigate]);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useLogin() {
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation<UserDto, ApiRequestError, LoginInput>({
    mutationFn: (input) => authApi.login(input),
    onSuccess: (user) => {
      setUser(user);
      setLanguage(user.language);
      void queryClient.invalidateQueries();
      navigate(homePathFor(user.role), { replace: true });
    },
  });
}

export function useRegister() {
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  return useMutation<UserDto, ApiRequestError, RegisterInput>({
    mutationFn: (input) => authApi.register(input),
    onSuccess: (user) => {
      setUser(user);
      setLanguage(user.language);
      navigate(homePathFor(user.role), { replace: true });
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiRequestError, void>({
    mutationFn: () => authApi.logout(),
    // Clear locally whether or not the request succeeded: the user asked to
    // leave, and the cookies are gone either way once they reload.
    onSettled: () => {
      clear();
      queryClient.clear();
      navigate('/', { replace: true });
    },
  });
}

export function useUpdateProfile() {
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation<UserDto, ApiRequestError, UpdateProfileInput>({
    mutationFn: (input) => authApi.updateMe(input),
    onSuccess: (user) => setUser(user),
  });
}

export function useChangePassword() {
  return useMutation<unknown, ApiRequestError, ChangePasswordInput>({
    mutationFn: (input) => authApi.changePassword(input),
  });
}

export function useSendOtp() {
  return useMutation({ mutationFn: (phone?: string) => authApi.sendOtp(phone) });
}

export function useVerifyOtp() {
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation<UserDto, ApiRequestError, string>({
    mutationFn: (code) => authApi.verifyOtp(code),
    onSuccess: (user) => setUser(user),
  });
}
