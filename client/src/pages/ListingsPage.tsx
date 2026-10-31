import {
  ALLOWED_PHOTO_MIME_TYPES,
  CROPS,
  GRADE_DEFINITIONS,
  MAX_PHOTO_SIZE_MB,
  createListingSchema,
  getCropName,
  getGrade,
  type ListingDto,
} from '@farmfair/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useDeclineOffer, useOffersForListing } from '@/hooks/useOffers';
import { useCreateListing, useMyListings, useWithdrawListing } from '@/hooks/useListings';
import { getLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function ListingsPage() {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = React.useState(false);
  const listings = useMyListings();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('listings.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('listings.subtitle')}</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus aria-hidden="true" />
              {t('listings.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('listings.form.title')}</DialogTitle>
              <DialogDescription>{t('listings.form.description')}</DialogDescription>
            </DialogHeader>
            <CreateListingForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </header>

      {listings.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : listings.data && listings.data.items.length > 0 ? (
        <div className="space-y-4">
          {listings.data.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('listings.empty')}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create listing form
// ---------------------------------------------------------------------------

interface ListingFormValues {
  cropKey: string;
  grade: string;
  quantityKg: number;
  pricePerKg: number;
  readyDate: Date;
}

function CreateListingForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const language = getLanguage();
  const create = useCreateListing();
  const errorMessage = useApiErrorMessage();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoError, setPhotoError] = React.useState<string>();

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(createListingSchema) as never,
    defaultValues: {
      cropKey: CROPS[0]!.key,
      grade: 'A',
      quantityKg: 0,
      pricePerKg: 0,
      readyDate: new Date(),
    },
  });

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(undefined);
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (!(ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setPhotoError(t('listings.form.photoWrongType'));
      setPhotoFile(null);
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setPhotoError(t('listings.form.photoTooLarge'));
      setPhotoFile(null);
      return;
    }
    setPhotoFile(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoError(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      {
        cropKey: values.cropKey,
        grade: values.grade,
        quantityKg: values.quantityKg,
        pricePerKg: values.pricePerKg,
        readyDate: values.readyDate.toISOString().slice(0, 10),
        ...(photoFile ? { photo: photoFile } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('listings.form.success'));
          form.reset();
          removePhoto();
          onSuccess();
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={create.isError ? errorMessage(create.error) : undefined} />

      <FormField
        id="listing-crop"
        label={t('listings.form.cropLabel')}
        required
        requiredLabel={t('common.required')}
      >
        <Select
          value={form.watch('cropKey')}
          onValueChange={(value) => form.setValue('cropKey', value, { shouldValidate: true })}
        >
          <SelectTrigger id="listing-crop">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CROPS.map((crop) => (
              <SelectItem key={crop.key} value={crop.key}>
                {getCropName(crop.key, language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        id="listing-grade"
        label={t('listings.form.gradeLabel')}
        required
        requiredLabel={t('common.required')}
      >
        <Select
          value={form.watch('grade')}
          onValueChange={(value) => form.setValue('grade', value, { shouldValidate: true })}
        >
          <SelectTrigger id="listing-grade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRADE_DEFINITIONS.map((grade) => (
              <SelectItem key={grade.key} value={grade.key}>
                {grade.label[language]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="listing-quantity"
          label={t('listings.form.quantityLabel')}
          error={form.formState.errors.quantityKg?.message}
          required
          requiredLabel={t('common.required')}
        >
          <Input
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            {...form.register('quantityKg', { valueAsNumber: true })}
          />
        </FormField>

        <FormField
          id="listing-price"
          label={t('listings.form.priceLabel')}
          error={form.formState.errors.pricePerKg?.message}
          required
          requiredLabel={t('common.required')}
        >
          <Input
            type="number"
            min={0.5}
            step="0.01"
            inputMode="decimal"
            {...form.register('pricePerKg', { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <FormField
        id="listing-ready-date"
        label={t('listings.form.readyDateLabel')}
        error={form.formState.errors.readyDate?.message}
        required
        requiredLabel={t('common.required')}
      >
        <Input type="date" {...form.register('readyDate', { valueAsDate: true })} />
      </FormField>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="listing-photo">{t('listings.form.photoLabel')}</Label>
          <span className="text-xs text-muted-foreground">
            {t('listings.form.photoOptionalLabel')}
          </span>
        </div>
        <input
          id="listing-photo"
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_PHOTO_MIME_TYPES.join(',')}
          className="hidden"
          onChange={handlePhotoChange}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            {photoFile ? t('listings.form.photoChange') : t('listings.form.photoChoose')}
          </Button>
          {photoFile && (
            <>
              <span className="max-w-[12rem] truncate text-sm text-muted-foreground">
                {photoFile.name}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={removePhoto}>
                {t('listings.form.photoRemove')}
              </Button>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('listings.form.photoHint')}</p>
        {photoError && (
          <p role="alert" className="text-sm text-destructive">
            {photoError}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {create.isPending ? t('listings.form.submitting') : t('listings.form.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Listing card
// ---------------------------------------------------------------------------

function ListingStatusBadge({ status }: { status: ListingDto['status'] }) {
  const { t } = useTranslation();
  const variant = status === 'active' ? 'success' : status === 'expired' ? 'warning' : 'secondary';
  return <Badge variant={variant}>{t(`listings.card.status.${status}`)}</Badge>;
}

function ListingCard({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation();
  const language = getLanguage();
  const [expanded, setExpanded] = React.useState(false);
  const withdraw = useWithdrawListing();

  const daysLeft = Math.ceil(
    (new Date(listing.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {listing.photoUrl && (
              <img
                src={listing.photoUrl}
                alt=""
                className="size-16 shrink-0 rounded-md border object-cover"
              />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{getCropName(listing.cropKey, language)}</span>
                <Badge variant="secondary">{getGrade(listing.grade)?.label[language]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                ₹{listing.pricePerKg} {t('common.perKg')} ·{' '}
                {t('listings.card.quantityAvailable', { quantity: listing.quantityKg })}
              </p>
            </div>
          </div>
          <ListingStatusBadge status={listing.status} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {listing.status === 'active' &&
              (daysLeft <= 0
                ? t('listings.card.expiresToday')
                : t('listings.card.expiresIn', { count: daysLeft }))}
          </span>

          <div className="flex items-center gap-2">
            {(listing.offerCount ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('listings.card.offerCount', { count: listing.offerCount })}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? t('listings.card.hideOffers') : t('listings.card.viewOffers')}
            </Button>
            {listing.status === 'active' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={withdraw.isPending}
                onClick={() =>
                  withdraw.mutate(listing.id, {
                    onSuccess: () => toast.success(t('listings.card.withdrawnToast')),
                  })
                }
              >
                {withdraw.isPending ? t('listings.card.withdrawing') : t('listings.card.withdraw')}
              </Button>
            )}
          </div>
        </div>

        {expanded && <ListingOffers listingId={listing.id} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Offers received on a listing
// ---------------------------------------------------------------------------

function OfferStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const variant = status === 'pending' ? 'info' : status === 'declined' ? 'danger' : 'secondary';
  return <Badge variant={variant}>{t(`listings.offers.status.${status}`)}</Badge>;
}

function ListingOffers({ listingId }: { listingId: string }) {
  const { t } = useTranslation();
  const offers = useOffersForListing(listingId);
  const decline = useDeclineOffer();
  const [decliningId, setDecliningId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');

  if (offers.isLoading) {
    return <Skeleton className="h-16" />;
  }
  if (!offers.data || offers.data.items.length === 0) {
    return (
      <p className="border-t pt-3 text-sm text-muted-foreground">{t('listings.offers.empty')}</p>
    );
  }

  return (
    <div className="space-y-2 border-t pt-3">
      {offers.data.items.map((offer) => (
        <div key={offer.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{offer.buyer.name}</span>
            <OfferStatusBadge status={offer.status} />
          </div>
          <p className="text-muted-foreground">
            ₹{offer.offeredPricePerKg} {t('common.perKg')} · {offer.quantityKg} {t('common.kg')}
          </p>
          {offer.diffPercent !== undefined && (
            <p
              className={cn(
                'text-xs font-medium',
                offer.diffPercent >= 0 ? 'text-success' : 'text-warning',
              )}
            >
              {t(
                offer.diffPercent >= 0
                  ? 'listings.offers.vsMarketUp'
                  : 'listings.offers.vsMarketDown',
                { percent: Math.abs(offer.diffPercent) },
              )}
            </p>
          )}
          {offer.message && <p className="mt-1 italic text-muted-foreground">“{offer.message}”</p>}

          {offer.status === 'pending' &&
            (decliningId === offer.id ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t('listings.offers.declineReasonLabel')}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={decline.isPending}
                    onClick={() =>
                      decline.mutate(
                        { id: offer.id, reason: reason.trim() || undefined },
                        {
                          onSuccess: () => {
                            toast.success(t('listings.offers.declinedToast'));
                            setDecliningId(null);
                            setReason('');
                          },
                        },
                      )
                    }
                  >
                    {decline.isPending
                      ? t('listings.offers.declining')
                      : t('listings.offers.declineSubmit')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDecliningId(null);
                      setReason('');
                    }}
                  >
                    {t('listings.offers.declineCancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setDecliningId(offer.id)}
              >
                {t('listings.offers.decline')}
              </Button>
            ))}
        </div>
      ))}
    </div>
  );
}
