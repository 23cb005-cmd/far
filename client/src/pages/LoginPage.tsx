import { loginSchema } from '@farmfair/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLogin } from '@/hooks/useAuth';

/**
 * The resolver validates against the same Zod schema the server uses, so the
 * phone is normalised to +91XXXXXXXXXX before it ever leaves the browser and
 * the rules cannot drift between the two.
 */
interface LoginFormValues {
  phone: string;
  password: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const errorMessage = useApiErrorMessage();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = React.useState(false);

  const sessionExpired = searchParams.get('expired') === '1';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values);
  });

  const busy = isSubmitting || login.isPending;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-secondary/30 px-4 py-12">
      <Logo className="mb-6" />

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.login.title')}</CardTitle>
          <CardDescription>{t('auth.login.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent>
          {sessionExpired && (
            <div
              role="status"
              className="mb-4 rounded-md border border-info/40 bg-info-muted px-3 py-2.5 text-sm"
            >
              {t('auth.sessionExpired')}
            </div>
          )}

          <FormError message={login.isError ? errorMessage(login.error) : undefined} />

          <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
            <FormField
              id="phone"
              label={t('auth.fields.phone')}
              error={errors.phone?.message}
              hint={t('auth.fields.phoneHint')}
              required
              requiredLabel={t('common.required')}
            >
              <Input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder={t('auth.fields.phonePlaceholder')}
                {...register('phone')}
              />
            </FormField>

            <FormField
              id="password"
              label={t('auth.fields.password')}
              error={errors.password?.message}
              required
              requiredLabel={t('common.required')}
            >
              {(control) => (
                <div className="relative">
                  <Input
                    {...control}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-11"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    // aria-pressed, so a screen reader announces the current
                    // state rather than only the action.
                    aria-pressed={showPassword}
                    aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                    className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}
            </FormField>

            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {busy ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t('auth.login.registerLink')}
            </Link>
          </p>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
        {t('auth.login.forgot')} {t('auth.login.forgotHint')}
      </p>
    </div>
  );
}
