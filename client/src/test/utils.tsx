import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type * as React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import i18n from '@/lib/i18n';

/**
 * Renders a component inside the providers the real app supplies.
 *
 * Retries are off and the cache is fresh per test so one test's query state
 * cannot leak into the next.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/', ...options }: RenderOptions & { route?: string } = {},
): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const result = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>,
    options,
  );

  return { ...result, queryClient };
}
