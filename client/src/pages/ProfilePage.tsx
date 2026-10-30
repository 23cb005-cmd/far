import {
  CROPS,
  TN_DISTRICTS,
  changePasswordSchema,
  cropsSchema,
  districtSchema,
  getCropName,
  gstNumberSchema,
  languageSchema,
  maskPhone,
  nameSchema,
  villageSchema,
  type Language,
} from '@farmfair/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, Check, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useChangePassword, useSendOtp, useUpdateProfile, useVerifyOtp } from '@/hooks/useAuth';
import { getLanguage, setLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUser } from '@/store/auth';

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') ?? 'details';

  if (!user) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('profile.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('profile.subtitle')}</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
      >
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="details">{t('profile.tabs.details')}</TabsTrigger>
          <TabsTrigger value="security">{t('profile.tabs.security')}</TabsTrigger>
          <TabsTrigger value="alerts">{t('profile.tabs.alerts')}</TabsTrigger>
          <TabsTrigger value="phone">{t('profile.tabs.verification')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <DetailsSection />
        </TabsContent>
        <TabsContent value="security">
          <PasswordSection />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsSection />
        </TabsContent>
        <TabsContent value="phone">
          <PhoneSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

const detailsSchema = z.object({
  name: nameSchema,
  district: districtSchema,
  village: villageSchema,
  crops: cropsSchema,
  language: languageSchema,
  businessName: z.string().trim().max(120).optional(),
  gstNumber: gstNumberSchema.optional(),
});

/**
 * What the controls hold. Declared rather than inferred from the schema: the
 * district select starts as an empty string before a choice exists, which the
 * enum in `detailsSchema` rightly rejects as a *submitted* value.
 */
interface DetailsValues {
  name: string;
  district: string;
  village: string;
  crops: string[];
  language: Language;
  businessName: string;
  gstNumber: string;
}

function DetailsSection() {
  const { t } = useTranslation();
  const user = useUser();
  const update = useUpdateProfile();
  const errorMessage = useApiErrorMessage();
  const language = getLanguage();

  const isBuyer = user?.role === 'buyer';

  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema) as unknown as Resolver<DetailsValues>,
    defaultValues: {
      name: user?.name ?? '',
      district: user?.district ?? '',
      village: user?.village ?? '',
      crops: user?.crops ?? [],
      language: user?.language ?? 'en',
      businessName: user?.business?.name ?? '',
      gstNumber: user?.business?.gstNumber ?? '',
    },
  });

  const selectedCrops = form.watch('crops') ?? [];

  const onSubmit = form.handleSubmit(() => {
    const parsed = detailsSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    const values = parsed.data;

    update.mutate(
      {
        name: values.name,
        district: values.district,
        village: values.village,
        crops: values.crops,
        language: values.language,
        ...(isBuyer && values.businessName
          ? {
              business: {
                name: values.businessName,
                ...(values.gstNumber ? { gstNumber: values.gstNumber } : {}),
              },
            }
          : {}),
      },
      {
        onSuccess: (updated) => {
          setLanguage(updated.language as Language);
          toast.success(t('profile.details.saved'));
        },
      },
    );
  });

  const toggleCrop = (key: string) => {
    const next = selectedCrops.includes(key)
      ? selectedCrops.filter((crop) => crop !== key)
      : [...selectedCrops, key];
    form.setValue('crops', next, { shouldValidate: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.details.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormError
          message={update.isError ? errorMessage(update.error) : undefined}
          className="mb-4"
        />

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormField
            id="profile-name"
            label={t('auth.fields.name')}
            error={form.formState.errors.name?.message}
            required
            requiredLabel={t('common.required')}
          >
            <Input autoComplete="name" {...form.register('name')} />
          </FormField>

          {/* The phone is changed through OTP verification, not here. */}
          <FormField id="profile-phone" label={t('auth.fields.phone')}>
            <Input value={user?.phone ?? ''} readOnly disabled />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="profile-district"
              label={t('auth.fields.district')}
              error={form.formState.errors.district?.message}
              required
              requiredLabel={t('common.required')}
            >
              <Select
                value={form.watch('district')}
                onValueChange={(value) =>
                  form.setValue('district', value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="profile-district">
                  <SelectValue placeholder={t('common.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {TN_DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              id="profile-village"
              label={t('auth.fields.village')}
              error={form.formState.errors.village?.message}
              optionalLabel={t('common.optional')}
            >
              <Input {...form.register('village')} />
            </FormField>
          </div>

          <FormField id="profile-language" label={t('auth.fields.language')}>
            <Select
              value={form.watch('language')}
              onValueChange={(value) =>
                form.setValue('language', value as Language, { shouldValidate: true })
              }
            >
              <SelectTrigger id="profile-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ta">தமிழ்</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <fieldset>
            <legend className="text-sm font-medium">{t('auth.fields.crops')}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {CROPS.map((crop) => {
                const selected = selectedCrops.includes(crop.key);
                return (
                  <button
                    key={crop.key}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggleCrop(crop.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-secondary',
                    )}
                  >
                    {selected && <Check className="size-3.5" aria-hidden="true" />}
                    {getCropName(crop.key, language)}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.crops && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {form.formState.errors.crops.message}
              </p>
            )}
          </fieldset>

          {isBuyer && (
            <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
              <FormField
                id="profile-business"
                label={t('auth.fields.businessName')}
                error={form.formState.errors.businessName?.message}
              >
                <Input autoComplete="organization" {...form.register('businessName')} />
              </FormField>
              <FormField
                id="profile-gst"
                label={t('auth.fields.gstNumber')}
                error={form.formState.errors.gstNumber?.message}
                optionalLabel={t('common.optional')}
              >
                <Input autoCapitalize="characters" {...form.register('gstNumber')} />
              </FormField>
            </div>
          )}

          <Button type="submit" disabled={update.isPending}>
            {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {update.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

function PasswordSection() {
  const { t } = useTranslation();
  const change = useChangePassword();
  const errorMessage = useApiErrorMessage();
  const [show, setShow] = React.useState(false);

  const form = useForm<{ currentPassword: string; newPassword: string }>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    change.mutate(values, {
      onSuccess: () => {
        toast.success(t('profile.security.changed'));
        form.reset();
      },
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.security.title')}</CardTitle>
        <CardDescription>{t('profile.security.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormError
          message={change.isError ? errorMessage(change.error) : undefined}
          className="mb-4"
        />

        <form onSubmit={onSubmit} className="max-w-md space-y-5" noValidate>
          <FormField
            id="current-password"
            label={t('auth.fields.currentPassword')}
            error={form.formState.errors.currentPassword?.message}
            required
            requiredLabel={t('common.required')}
          >
            <Input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              {...form.register('currentPassword')}
            />
          </FormField>

          <FormField
            id="new-password"
            label={t('auth.fields.newPassword')}
            error={form.formState.errors.newPassword?.message}
            hint={t('auth.fields.passwordHint')}
            required
            requiredLabel={t('common.required')}
          >
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-11"
                  {...form.register('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShow((previous) => !previous)}
                  aria-pressed={show}
                  aria-label={show ? t('common.hidePassword') : t('common.showPassword')}
                  className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {show ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </FormField>

          <Button type="submit" disabled={change.isPending}>
            {change.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t('profile.security.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

function AlertsSection() {
  const { t } = useTranslation();
  const user = useUser();
  const update = useUpdateProfile();
  const errorMessage = useApiErrorMessage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.alerts.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormError message={update.isError ? errorMessage(update.error) : undefined} />

        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="notify-whatsapp" className="text-base">
              {t('profile.alerts.whatsapp')}
            </Label>
            <p id="notify-whatsapp-hint" className="text-sm text-muted-foreground">
              {t('profile.alerts.whatsappHint')}
            </p>
          </div>
          <Switch
            id="notify-whatsapp"
            aria-describedby="notify-whatsapp-hint"
            checked={user?.notifyWhatsApp ?? false}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              update.mutate(
                { notifyWhatsApp: checked },
                { onSuccess: () => toast.success(t('profile.alerts.saved')) },
              )
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phone verification
// ---------------------------------------------------------------------------

function PhoneSection() {
  const { t } = useTranslation();
  const user = useUser();
  const send = useSendOtp();
  const verify = useVerifyOtp();
  const errorMessage = useApiErrorMessage();
  const [code, setCode] = React.useState('');

  const sent = send.isSuccess;
  const devCode = send.data?.devCode;

  if (user?.phoneVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.phone.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="success" className="text-sm">
            <BadgeCheck aria-hidden="true" />
            {t('profile.phone.verified')}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.phone.title')}</CardTitle>
        <CardDescription>{t('profile.phone.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge variant="warning" className="text-sm">
          <ShieldAlert aria-hidden="true" />
          {t('profile.phone.notVerified')}
        </Badge>

        <FormError
          message={
            send.isError
              ? errorMessage(send.error)
              : verify.isError
                ? errorMessage(verify.error)
                : undefined
          }
        />

        {!sent ? (
          <Button onClick={() => send.mutate(undefined)} disabled={send.isPending}>
            {send.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {send.isPending ? t('profile.phone.sending') : t('profile.phone.send')}
          </Button>
        ) : (
          <div className="max-w-sm space-y-4">
            <p role="status" className="text-sm text-muted-foreground">
              {t('profile.phone.sent', { phone: maskPhone(user?.phone) })}
            </p>

            {/* The console OTP provider returns the code in development so
                there is no need for an SMS gateway while building. */}
            {devCode && (
              <p className="rounded-md border border-info/40 bg-info-muted px-3 py-2 text-sm font-medium">
                {t('profile.phone.devCode', { code: devCode })}
              </p>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                verify.mutate(code, {
                  onSuccess: () => {
                    toast.success(t('profile.phone.success'));
                    setCode('');
                  },
                });
              }}
              className="space-y-4"
            >
              <FormField
                id="otp-code"
                label={t('profile.phone.codeLabel')}
                required
                requiredLabel={t('common.required')}
              >
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder={t('profile.phone.codePlaceholder')}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
              </FormField>

              <div className="flex gap-2">
                <Button type="submit" disabled={verify.isPending || code.length !== 6}>
                  {verify.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {verify.isPending ? t('profile.phone.verifying') : t('profile.phone.verify')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => send.mutate(undefined)}
                  disabled={send.isPending}
                >
                  {t('profile.phone.resend')}
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
