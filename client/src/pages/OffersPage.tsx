import { getCropName, getGrade, type OfferDto } from '@farmfair/shared';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyOffers, useWithdrawOffer } from '@/hooks/useOffers';
import { getLanguage } from '@/lib/i18n';

function OfferStatusBadge({ status }: { status: OfferDto['status'] }) {
  const { t } = useTranslation();
  const variant = status === 'pending' ? 'info' : status === 'declined' ? 'danger' : 'secondary';
  return <Badge variant={variant}>{t(`offers.card.status.${status}`)}</Badge>;
}

export default function OffersPage() {
  const { t } = useTranslation();
  const offers = useMyOffers();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('offers.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('offers.subtitle')}</p>
      </header>

      {offers.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : offers.data && offers.data.items.length > 0 ? (
        <div className="space-y-4">
          {offers.data.items.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('offers.empty')}</p>
      )}
    </div>
  );
}

function OfferCard({ offer }: { offer: OfferDto }) {
  const { t } = useTranslation();
  const language = getLanguage();
  const withdraw = useWithdrawOffer();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div className="flex items-center gap-3">
          {offer.listing.photoUrl && (
            <img
              src={offer.listing.photoUrl}
              alt=""
              className="size-16 shrink-0 rounded-md border object-cover"
            />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{getCropName(offer.listing.cropKey, language)}</span>
              <Badge variant="secondary">{getGrade(offer.listing.grade)?.label[language]}</Badge>
              <OfferStatusBadge status={offer.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('offers.card.offered', { price: offer.offeredPricePerKg })} ·{' '}
              {t('offers.card.quantity', { quantity: offer.quantityKg })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('offers.card.asking', { price: offer.listing.pricePerKg })}
            </p>
            {offer.declineReason && (
              <p className="mt-1 text-sm italic text-muted-foreground">
                &ldquo;{offer.declineReason}&rdquo;
              </p>
            )}
          </div>
        </div>

        {offer.status === 'pending' && (
          <Button
            variant="outline"
            size="sm"
            disabled={withdraw.isPending}
            onClick={() =>
              withdraw.mutate(offer.id, {
                onSuccess: () => toast.success(t('offers.card.withdrawnToast')),
              })
            }
          >
            {withdraw.isPending ? t('offers.card.withdrawing') : t('offers.card.withdraw')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
