import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single broken component does not leave the user
 * staring at a blank page. Class-based because React has no hook equivalent.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Phase 8 adds an optional Sentry hook here.
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

export function ErrorFallback({ error }: { error: Error }) {
  const { t } = useTranslation();
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-danger-muted">
            <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
          </div>
          <CardTitle>{t('errors.boundary.title')}</CardTitle>
          <CardDescription>{t('errors.boundary.body')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* The message can contain internals, so it is development only. */}
          {isDev && (
            <details className="rounded-md bg-muted p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                {t('errors.boundary.details')}
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>{t('errors.boundary.reload')}</Button>
            <Button asChild variant="outline">
              <a href="/">{t('errors.notFound.home')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
