import {
  CROPS,
  SELF_REGISTERABLE_ROLES,
  TN_DISTRICTS,
  cropsSchema,
  districtSchema,
  getCropName,
  gstNumberSchema,
  languageSchema,
  nameSchema,
  normalisePhone,
  passwordSchema,
  phoneSchema,
  villageSchema,
  type Language,
  type RegisterInput,
  type SelfRegisterableRole,
} from '@farmfair/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, Loader2, ShoppingCart, Sprout } from 'lucide-react';
import * as React from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useRegister } from '@/hooks/useAuth';
import { getLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Form schema
//
// Built from the same field primitives the server uses, so the rules cannot
// drift. It differs from the shared `registerSchema` in one way: the form
// always holds a `business` object (empty strings for a farmer), because a
// controlled input cannot have an undefined value. Business fields are
// therefore required conditionally here rather than structurally.
// ---------------------------------------------------------------------------

const formSchema = z
  .object({
    role: z.enum(SELF_REGISTERABLE_ROLES, {
      errorMap: () => ({ message: 'Choose whether you are a farmer or a buyer' }),
    }),
    name: nameSchema,
    phone: phoneSchema,
    password: passwordSchema,
    district: districtSchema,
    village: villageSchema,
    crops: cropsSchema,
    language: languageSchema,
    business: z.object({
      name: z.string().trim().max(120, 'Business name must be at most 120 characters'),
      gstNumber: gstNumberSchema,
    }),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'buyer' && value.business.name.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['business', 'name'],
        message: 'Business name is required for buyers',
      });
    }
    if (value.role === 'farmer' && value.crops.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['crops'],
        message: 'Select at least one crop you grow',
      });
    }
  });

/** What the inputs hold. The parsed output has the phone normalised. */
interface RegisterFormValues {
  role: SelfRegisterableRole | '';
  name: string;
  phone: string;
  password: string;
  district: string;
  village: string;
  crops: string[];
  language: Language;
  business: { name: string; gstNumber: string };
}

/** Map validated form values onto the API payload. */
function toRegisterPayload(values: z.output<typeof formSchema>): RegisterInput {
  return {
    name: values.name,
    phone: values.phone,
    password: values.password,
    role: values.role,
    district: values.district,
    ...(values.village ? { village: values.village } : {}),
    crops: values.crops,
    language: values.language,
    ...(values.role === 'buyer'
      ? {
          business: {
            name: values.business.name,
            ...(values.business.gstNumber ? { gstNumber: values.business.gstNumber } : {}),
          },
        }
      : {}),
  };
}

type StepId = 'role' | 'details' | 'location' | 'business' | 'review';

/** Which fields each step is responsible for, for per-step validation. */
const STEP_FIELDS: Record<StepId, Array<keyof RegisterFormValues | string>> = {
  role: ['role'],
  details: ['name', 'phone', 'password'],
  location: ['district', 'village', 'crops'],
  business: ['business.name', 'business.gstNumber'],
  review: [],
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const registerMutation = useRegister();
  const errorMessage = useApiErrorMessage();
  const [showPassword, setShowPassword] = React.useState(false);

  // The landing page links in with ?role=farmer / ?role=buyer so the visitor
  // lands on step 2 having already answered the first question.
  const roleFromQuery = searchParams.get('role');
  const initialRole: SelfRegisterableRole | '' =
    roleFromQuery === 'farmer' || roleFromQuery === 'buyer' ? roleFromQuery : '';

  const form = useForm<RegisterFormValues>({
    // The whole schema is evaluated on every validation pass, but `trigger` is
    // scoped to the current step's fields so the user never sees an error for
    // a page they have not reached yet.
    resolver: zodResolver(formSchema) as unknown as Resolver<RegisterFormValues>,
    mode: 'onTouched',
    defaultValues: {
      role: initialRole,
      name: '',
      phone: '',
      password: '',
      district: '',
      village: '',
      crops: [],
      language: getLanguage(),
      business: { name: '', gstNumber: '' },
    },
  });

  const role = form.watch('role');
  const isBuyer = role === 'buyer';

  const steps = React.useMemo<StepId[]>(
    () =>
      isBuyer
        ? ['role', 'details', 'location', 'business', 'review']
        : ['role', 'details', 'location', 'review'],
    [isBuyer],
  );

  const [stepIndex, setStepIndex] = React.useState(initialRole ? 1 : 0);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)] ?? 'role';

  // Switching role mid-flow can shorten the step list; keep the index in range.
  React.useEffect(() => {
    setStepIndex((index) => Math.min(index, steps.length - 1));
  }, [steps.length]);

  const goNext = async () => {
    const fields = STEP_FIELDS[currentStep];
    const valid =
      fields.length === 0 ? true : await form.trigger(fields as never, { shouldFocus: true });
    if (valid) setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  const goBack = () => setStepIndex((index) => Math.max(index - 1, 0));

  const onSubmit = form.handleSubmit(() => {
    // Re-parse to obtain the transformed output (phone in +91 form, GSTIN
    // upper-cased). The transforms are idempotent, so this is safe even though
    // the resolver has already run.
    const parsed = formSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    registerMutation.mutate(toRegisterPayload(parsed.data));
  });

  const busy = registerMutation.isPending;

  return (
    <div className="flex min-h-dvh flex-col items-center bg-secondary/30 px-4 py-10">
      <Logo className="mb-6" />

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.register.title')}</CardTitle>
          <CardDescription>{t('auth.register.subtitle')}</CardDescription>

          <StepIndicator steps={steps} currentIndex={stepIndex} />
        </CardHeader>

        <CardContent>
          <FormError
            message={registerMutation.isError ? errorMessage(registerMutation.error) : undefined}
            className="mb-4"
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (currentStep === 'review') void onSubmit();
            }}
            noValidate
          >
            {currentStep === 'role' && <RoleStep form={form} onPick={() => setStepIndex(1)} />}
            {currentStep === 'details' && (
              <DetailsStep
                form={form}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword((previous) => !previous)}
              />
            )}
            {currentStep === 'location' && <LocationStep form={form} isBuyer={isBuyer} />}
            {currentStep === 'business' && <BusinessStep form={form} />}
            {currentStep === 'review' && (
              <ReviewStep
                values={form.getValues()}
                onEdit={(step) => setStepIndex(steps.indexOf(step))}
              />
            )}

            <div className="mt-8 flex gap-3">
              {stepIndex > 0 && (
                <Button type="button" variant="outline" onClick={goBack} disabled={busy}>
                  {t('common.back')}
                </Button>
              )}
              <div className="flex-1" />
              {currentStep === 'review' ? (
                <Button type="submit" size="lg" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {busy ? t('auth.register.submitting') : t('auth.register.submit')}
                </Button>
              ) : (
                currentStep !== 'role' && (
                  <Button type="button" size="lg" onClick={() => void goNext()}>
                    {t('common.next')}
                  </Button>
                )
              )}
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.register.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('auth.register.loginLink')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

function StepIndicator({ steps, currentIndex }: { steps: StepId[]; currentIndex: number }) {
  const { t } = useTranslation();

  return (
    <div className="pt-4">
      <p className="mb-2 text-sm font-medium text-muted-foreground" aria-live="polite">
        {t('common.step', { current: currentIndex + 1, total: steps.length })} ·{' '}
        {t(`auth.register.steps.${steps[currentIndex] ?? 'role'}`)}
      </p>
      <ol className="flex gap-1.5">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step} className="flex-1">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-colors',
                  done || active ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span className="sr-only">
                {t(`auth.register.steps.${step}`)}
                {done ? ` - ${t('a11y.stepComplete')}` : ''}
                {active ? ` - ${t('a11y.currentStep')}` : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: role
// ---------------------------------------------------------------------------

type FormApi = ReturnType<typeof useForm<RegisterFormValues>>;

function RoleStep({ form, onPick }: { form: FormApi; onPick: () => void }) {
  const { t } = useTranslation();
  const selected = form.watch('role');

  const options = [
    { value: 'farmer' as const, icon: Sprout },
    { value: 'buyer' as const, icon: ShoppingCart },
  ];

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">{t('auth.register.role.title')}</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        {options.map(({ value, icon: Icon }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                form.setValue('role', value, { shouldValidate: true });
                onPick();
              }}
              className={cn(
                'flex flex-col items-start gap-3 rounded-lg border-2 p-5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-secondary/50',
              )}
            >
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-lg',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                )}
                aria-hidden="true"
              >
                <Icon className="size-6" />
              </span>
              <span className="text-base font-semibold">
                {t(`auth.register.role.${value}.title`)}
              </span>
              <span className="text-sm text-muted-foreground">
                {t(`auth.register.role.${value}.body`)}
              </span>
            </button>
          );
        })}
      </div>

      {selected === 'buyer' && (
        <p
          role="status"
          className="rounded-md border border-info/40 bg-info-muted px-3 py-2.5 text-sm"
        >
          {t('auth.register.role.buyerNote')}
        </p>
      )}

      {form.formState.errors.role && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.role.message}
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Step 2: personal details
// ---------------------------------------------------------------------------

function DetailsStep({
  form,
  showPassword,
  onTogglePassword,
}: {
  form: FormApi;
  showPassword: boolean;
  onTogglePassword: () => void;
}) {
  const { t } = useTranslation();
  const { errors } = form.formState;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t('auth.register.details.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('auth.register.details.subtitle')}</p>
      </div>

      <FormField
        id="name"
        label={t('auth.fields.name')}
        error={errors.name?.message}
        required
        requiredLabel={t('common.required')}
      >
        <Input
          autoComplete="name"
          placeholder={t('auth.fields.namePlaceholder')}
          {...form.register('name')}
        />
      </FormField>

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
          {...form.register('phone')}
        />
      </FormField>

      <FormField
        id="password"
        label={t('auth.fields.password')}
        error={errors.password?.message}
        hint={t('auth.fields.passwordHint')}
        required
        requiredLabel={t('common.required')}
      >
        {(control) => (
          <div className="relative">
            <Input
              {...control}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-11"
              placeholder={t('auth.fields.passwordPlaceholder')}
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={onTogglePassword}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: location and crops
// ---------------------------------------------------------------------------

function LocationStep({ form, isBuyer }: { form: FormApi; isBuyer: boolean }) {
  const { t } = useTranslation();
  const { errors } = form.formState;
  const language = getLanguage();
  const selectedCrops = form.watch('crops');

  const toggleCrop = (key: string) => {
    const next = selectedCrops.includes(key)
      ? selectedCrops.filter((crop) => crop !== key)
      : [...selectedCrops, key];
    form.setValue('crops', next, { shouldValidate: true });
  };

  const cropsError = errors.crops?.message;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t('auth.register.location.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {isBuyer
            ? t('auth.register.location.subtitleBuyer')
            : t('auth.register.location.subtitleFarmer')}
        </p>
      </div>

      <FormField
        id="district"
        label={t('auth.fields.district')}
        error={errors.district?.message}
        required
        requiredLabel={t('common.required')}
      >
        <Select
          value={form.watch('district')}
          onValueChange={(value) => form.setValue('district', value, { shouldValidate: true })}
        >
          <SelectTrigger id="district" aria-invalid={errors.district ? true : undefined}>
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
        id="village"
        label={t('auth.fields.village')}
        error={errors.village?.message}
        optionalLabel={t('common.optional')}
      >
        <Input placeholder={t('auth.fields.villagePlaceholder')} {...form.register('village')} />
      </FormField>

      {/* Crop multi-select: chips rather than a <select multiple>, which is
          close to unusable on a phone. */}
      <fieldset>
        <legend className="text-sm font-medium">
          {isBuyer
            ? t('auth.register.location.cropsLabelBuyer')
            : t('auth.register.location.cropsLabelFarmer')}
          {!isBuyer && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </legend>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('auth.register.location.cropsHint')}
          {selectedCrops.length > 0 && (
            <>
              {' · '}
              {t('auth.register.location.cropsSelected', { count: selectedCrops.length })}
            </>
          )}
        </p>

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

        {cropsError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {cropsError}
          </p>
        )}
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: business details (buyers only)
// ---------------------------------------------------------------------------

function BusinessStep({ form }: { form: FormApi }) {
  const { t } = useTranslation();
  const errors = form.formState.errors.business;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t('auth.register.business.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('auth.register.business.subtitle')}</p>
      </div>

      <FormField
        id="business-name"
        label={t('auth.fields.businessName')}
        error={errors?.name?.message}
        required
        requiredLabel={t('common.required')}
      >
        <Input
          autoComplete="organization"
          placeholder={t('auth.fields.businessNamePlaceholder')}
          {...form.register('business.name')}
        />
      </FormField>

      <FormField
        id="business-gst"
        label={t('auth.fields.gstNumber')}
        error={errors?.gstNumber?.message}
        hint={t('auth.fields.gstHint')}
        optionalLabel={t('common.optional')}
      >
        <Input
          autoCapitalize="characters"
          placeholder={t('auth.fields.gstPlaceholder')}
          {...form.register('business.gstNumber')}
        />
      </FormField>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: review
// ---------------------------------------------------------------------------

function ReviewStep({
  values,
  onEdit,
}: {
  values: RegisterFormValues;
  onEdit: (step: StepId) => void;
}) {
  const { t } = useTranslation();
  const language = getLanguage();

  const rows: Array<{ step: StepId; label: string; value: React.ReactNode }> = [
    {
      step: 'role',
      label: t('auth.fields.role'),
      value: values.role ? t(`auth.register.role.${values.role}.title`) : '-',
    },
    { step: 'details', label: t('auth.fields.name'), value: values.name },
    {
      step: 'details',
      // Show the canonical form, which is what will actually be stored.
      label: t('auth.fields.phone'),
      value: normalisePhone(values.phone) ?? values.phone,
    },
    { step: 'location', label: t('auth.fields.district'), value: values.district },
    { step: 'location', label: t('auth.fields.village'), value: values.village || '-' },
    {
      step: 'location',
      label: t('auth.fields.crops'),
      value:
        values.crops.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {values.crops.map((crop) => (
              <Badge key={crop} variant="secondary">
                {getCropName(crop, language)}
              </Badge>
            ))}
          </span>
        ) : (
          '-'
        ),
    },
  ];

  if (values.role === 'buyer') {
    rows.push(
      { step: 'business', label: t('auth.fields.businessName'), value: values.business.name },
      {
        step: 'business',
        label: t('auth.fields.gstNumber'),
        value: values.business.gstNumber || '-',
      },
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t('auth.register.review.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('auth.register.review.subtitle')}</p>
      </div>

      <dl className="divide-y rounded-lg border">
        {rows.map((row, index) => (
          <div key={`${row.step}-${index}`} className="flex items-start gap-3 px-4 py-3">
            <dt className="w-32 shrink-0 text-sm text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium">{row.value}</dd>
            <button
              type="button"
              onClick={() => onEdit(row.step)}
              className="shrink-0 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('auth.register.review.edit')}
              <span className="sr-only"> {row.label}</span>
            </button>
          </div>
        ))}
      </dl>
    </div>
  );
}
