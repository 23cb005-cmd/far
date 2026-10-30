import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '@/lib/api';

/**
 * Turn an API failure into a translated sentence.
 *
 * The server's `code` is the key, so the user sees Tamil or English regardless
 * of which language the API happened to phrase its message in. An unmapped
 * code falls back to the server's own message, which is still better than a
 * generic failure.
 */
export function useApiErrorMessage(): (error: unknown) => string | undefined {
  const { t } = useTranslation();

  return React.useCallback(
    (error: unknown): string | undefined => {
      if (!error) return undefined;

      if (error instanceof ApiRequestError) {
        const key = `auth.errors.${error.code}`;
        const translated = t(key);
        if (translated !== key) return translated;
        return error.message;
      }

      if (error instanceof Error) return error.message;
      return t('auth.errors.UNKNOWN_ERROR');
    },
    [t],
  );
}

/** Map a 400 response onto react-hook-form field errors. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiRequestError)) return {};
  return Object.fromEntries(error.fieldErrors.map((issue) => [issue.path, issue.message]));
}
