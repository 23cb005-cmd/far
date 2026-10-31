import {
  CROPS,
  GRADE_DEFINITIONS,
  TN_DISTRICTS,
  createOfferSchema,
  getCropName,
  getGrade,
  type ListingDto,
} from '@farmfair/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Star } from 'lucide-react';
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
import { useBrowseListings } from '@/hooks/useListings';
import { useCreateOffer } from '@/hooks/useOffers';
import { getLanguage } from '@/lib/i18n';
import { useUser } from '@/store/auth';

const ANY = '__any__';

interface Filters {
  crop: string;
  district: string;
  grade: string;
}

const DEFAULT_FILTERS: Filters = { crop: ANY, district: ANY, grade: ANY };

export default function BrowsePage() {
  const { t } = useTranslation();
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);

  const listings = useBrowseListings({
    ...(filters.crop !== ANY ? { crop: filters.crop } : {}),
    ...(filters.district !== ANY ? { district: filters.district } : {}),
    ...(filters.grade !== ANY ? { grade: filters.grade } : {}),
  });

  const hasFilters = filters.crop !== ANY || filters.district !== ANY || filters.grade !== ANY;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('browse.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('browse.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <FormField id="browse-crop" label={t('browse.filters.cropLabel')}>
            <Select
              value={filters.crop}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, crop: value }))}
            >
              <SelectTrigger id="browse-crop">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t('browse.filters.anyCrop')}</SelectItem>
                {CROPS.map((crop) => (
                  <SelectItem key={crop.key} value={crop.key}>
                    {getCropName(crop.key, getLanguage())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="w-44">
          <FormField id="browse-district" label={t('browse.filters.districtLabel')}>
            <Select
              value={filters.district}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, district: value }))}
            >
              <SelectTrigger id="browse-district">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t('browse.filters.anyDistrict')}</SelectItem>
                {TN_DISTRICTS.map((district) => (
                  <SelectItem key={district} value={district}>
                    {district}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="w-36">
          <FormField id="browse-grade" label={t('browse.filters.gradeLabel')}>
            <Select
              value={filters.grade}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, grade: value }))}
            >
              <SelectTrigger id="browse-grade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t('browse.filters.anyGrade')}</SelectItem>
                {GRADE_DEFINITIONS.map((grade) => (
                  <SelectItem key={grade.key} value={grade.key}>
                    {grade.label[getLanguage()]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            {t('browse.filters.clear')}
          </Button>
        )}
      </div>

      {listings.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : listings.data && listings.data.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.data.items.map((listing) => (
            <ListingBrowseCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('browse.empty')}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listing card + make-offer dialog
// ---------------------------------------------------------------------------

function ListingBrowseCard({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation();
  const language = getLanguage();
  const user = useUser();
  const [offerOpen, setOfferOpen] = React.useState(false);

  const canOffer = user?.role === 'buyer' && user.verificationStatus === 'approved';

  return (
    <Card className="flex flex-col overflow-hidden">
      {listing.photoUrl && (
        <img src={listing.photoUrl} alt="" className="h-36 w-full object-cover" />
      )}
      <CardContent className="flex flex-1 flex-col gap-2 pt-6">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{getCropName(listing.cropKey, language)}</span>
          <Badge variant="secondary">{getGrade(listing.grade)?.label[language]}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{listing.district}</p>

        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold">₹{listing.pricePerKg}</span>
          <span className="text-sm text-muted-foreground">{t('common.perKg')}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {listing.quantityKg} {t('common.kg')}
        </p>

        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{listing.farmer.name}</span>
          {listing.farmer.ratingCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="size-3.5 fill-current text-accent" aria-hidden="true" />
              {listing.farmer.ratingAvg.toFixed(1)}
            </span>
          )}
        </div>

        <div className="mt-auto pt-2">
          <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" disabled={!canOffer}>
                {t('browse.card.makeOffer')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('browse.offerDialog.title')}</DialogTitle>
                <DialogDescription>
                  {t('browse.offerDialog.askingPrice', { price: listing.pricePerKg })} ·{' '}
                  {t('browse.offerDialog.availableQuantity', { quantity: listing.quantityKg })}
                </DialogDescription>
              </DialogHeader>
              <MakeOfferForm listing={listing} onSuccess={() => setOfferOpen(false)} />
            </DialogContent>
          </Dialog>
          {!canOffer && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('browse.card.verificationRequired')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface OfferFormValues {
  quantityKg: number;
  offeredPricePerKg: number;
  message?: string;
}

function MakeOfferForm({ listing, onSuccess }: { listing: ListingDto; onSuccess: () => void }) {
  const { t } = useTranslation();
  const create = useCreateOffer();
  const errorMessage = useApiErrorMessage();

  const form = useForm<OfferFormValues>({
    resolver: zodResolver(createOfferSchema) as never,
    defaultValues: {
      quantityKg: listing.quantityKg,
      offeredPricePerKg: listing.pricePerKg,
      message: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      {
        listingId: listing.id,
        input: {
          quantityKg: values.quantityKg,
          offeredPricePerKg: values.offeredPricePerKg,
          ...(values.message ? { message: values.message } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(t('browse.offerDialog.success'));
          form.reset();
          onSuccess();
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={create.isError ? errorMessage(create.error) : undefined} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="offer-quantity"
          label={t('browse.offerDialog.quantityLabel')}
          error={form.formState.errors.quantityKg?.message}
          required
          requiredLabel={t('common.required')}
        >
          <Input
            type="number"
            min={1}
            max={listing.quantityKg}
            step="1"
            inputMode="numeric"
            {...form.register('quantityKg', { valueAsNumber: true })}
          />
        </FormField>

        <FormField
          id="offer-price"
          label={t('browse.offerDialog.priceLabel')}
          error={form.formState.errors.offeredPricePerKg?.message}
          required
          requiredLabel={t('common.required')}
        >
          <Input
            type="number"
            min={0.5}
            step="0.01"
            inputMode="decimal"
            {...form.register('offeredPricePerKg', { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <FormField
        id="offer-message"
        label={t('browse.offerDialog.messageLabel')}
        optionalLabel={t('browse.offerDialog.messageOptionalLabel')}
      >
        <Textarea rows={3} {...form.register('message')} />
      </FormField>

      <DialogFooter>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {create.isPending ? t('browse.offerDialog.submitting') : t('browse.offerDialog.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
