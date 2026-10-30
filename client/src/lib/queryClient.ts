import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

/**
 * Query defaults tuned for a user on a slow mobile connection:
 *
 * - data is considered fresh for a minute, so moving between pages does not
 *   refetch everything;
 * - a 4xx is never retried (it will fail the same way), while a network blip is
 *   retried twice with backoff;
 * - refetch on reconnect, because losing signal mid-task is the normal case.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache(),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Mutations are never retried automatically: a duplicate offer or
        // payment is far worse than an error the user can retry deliberately.
        retry: false,
      },
    },
  });
}
