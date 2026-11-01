import { getCropName, getGrade, type OrderDto } from '@farmfair/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Star } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormError, FormField } from '@/components/ui/form-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  useCancelOrder,
  useConfirmPickup,
  useMyOrders,
  usePayOrder,
  useSubmitRating,
} from '@/hooks/useOrders';
import { getLanguage } from '@/lib/i18n';
import { useUser } from '@/store/auth';

function OrderStatusBadge({ status }: { status: OrderDto['status'] }) {
  const { t } = useTranslation();
  const variant =
    status === 'completed'
      ? 'success'
      : status === 'paid'
        ? 'info'
        : status === 'cancelled'
          ? 'secondary'
          : 'warning';
  return <Badge variant={variant}>{t(`orders.card.status.${status}`)}</Badge>;
}

export default function OrdersPage() {
  const { t } = useTranslation();
  const orders = useMyOrders();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('orders.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('orders.subtitle')}</p>
      </header>

      {orders.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : orders.data && orders.data.items.length > 0 ? (
        <div className="space-y-4">
          {orders.data.items.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('orders.empty')}</p>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: OrderDto }) {
  const { t } = useTranslation();
  const language = getLanguage();
  const user = useUser();
  const errorMessage = useApiErrorMessage();

  const pay = usePayOrder();
  const confirm = useConfirmPickup();
  const cancel = useCancelOrder();
  const [cancelling, setCancelling] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');

  const isFarmer = order.farmer.id === user?.id;
  const otherParty = isFarmer ? order.buyer : order.farmer;
  const myConfirmedAt = isFarmer ? order.farmerConfirmedAt : order.buyerConfirmedAt;
  const otherConfirmedAt = isFarmer ? order.buyerConfirmedAt : order.farmerConfirmedAt;
  const otherPartyLabel = t(isFarmer ? 'orders.card.buyer' : 'orders.card.farmer');

  const mutationError = pay.isError
    ? pay.error
    : confirm.isError
      ? confirm.error
      : cancel.isError
        ? cancel.error
        : undefined;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {order.listing.photoUrl && (
              <img
                src={order.listing.photoUrl}
                alt=""
                className="size-16 shrink-0 rounded-md border object-cover"
              />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{getCropName(order.cropKey, language)}</span>
                <Badge variant="secondary">{getGrade(order.listing.grade)?.label[language]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('orders.card.quantity', { quantity: order.quantityKg })} · ₹{order.pricePerKg}{' '}
                {t('common.perKg')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('orders.card.totalAmount', { amount: order.totalAmount })}
              </p>
              {isFarmer && (
                <p className="text-xs text-muted-foreground">
                  {t('orders.card.payout', {
                    amount: order.payoutAmount,
                    percent: order.commissionPercent,
                  })}
                </p>
              )}
              <p className="text-sm text-muted-foreground">{otherParty.name}</p>
            </div>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <FormError message={mutationError ? errorMessage(mutationError) : undefined} />

        {order.status === 'pending_payment' && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {!isFarmer && (
              <Button
                size="sm"
                disabled={pay.isPending}
                onClick={() =>
                  pay.mutate(order.id, {
                    onSuccess: () => toast.success(t('orders.card.paidToast')),
                  })
                }
              >
                {pay.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {pay.isPending ? t('orders.card.paying') : t('orders.card.pay')}
              </Button>
            )}
            {!cancelling ? (
              <Button variant="ghost" size="sm" onClick={() => setCancelling(true)}>
                {t('orders.card.cancel')}
              </Button>
            ) : (
              <div className="w-full space-y-2">
                <Textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder={t('orders.card.cancelReasonLabel')}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={cancel.isPending}
                    onClick={() =>
                      cancel.mutate(
                        { id: order.id, reason: cancelReason.trim() || undefined },
                        {
                          onSuccess: () => {
                            toast.success(t('orders.card.cancelledToast'));
                            setCancelling(false);
                            setCancelReason('');
                          },
                        },
                      )
                    }
                  >
                    {cancel.isPending
                      ? t('orders.card.cancelling')
                      : t('orders.card.cancelConfirm')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>
                    {t('orders.card.cancelDismiss')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {order.status === 'paid' && (
          <div className="border-t pt-3">
            {myConfirmedAt ? (
              <p className="text-sm text-muted-foreground">
                {t('orders.card.youConfirmed', { party: otherPartyLabel })}
              </p>
            ) : (
              <Button
                size="sm"
                disabled={confirm.isPending}
                onClick={() =>
                  confirm.mutate(order.id, {
                    onSuccess: () => toast.success(t('orders.card.confirmedToast')),
                  })
                }
              >
                {confirm.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {confirm.isPending ? t('orders.card.confirming') : t('orders.card.confirmPickup')}
              </Button>
            )}
            {!otherConfirmedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('orders.card.waitingOnOther', { party: otherPartyLabel })}
              </p>
            )}
          </div>
        )}

        {order.status === 'completed' && (
          <div className="border-t pt-3">
            {order.myRatingSubmitted ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Star className="size-4 fill-current text-accent" aria-hidden="true" />
                {t('orders.card.rated')}
              </p>
            ) : (
              <RateOrderDialog orderId={order.id} rateeName={otherParty.name} />
            )}
          </div>
        )}

        {order.status === 'cancelled' && order.cancelReason && (
          <p className="border-t pt-3 text-sm italic text-muted-foreground">
            &ldquo;{order.cancelReason}&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Rating dialog
// ---------------------------------------------------------------------------

const ratingSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(300).optional(),
});

interface RatingFormValues {
  score: number;
  comment?: string;
}

function RateOrderDialog({ orderId, rateeName }: { orderId: string; rateeName: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const submitRating = useSubmitRating();
  const errorMessage = useApiErrorMessage();

  const form = useForm<RatingFormValues>({
    resolver: zodResolver(ratingSchema) as never,
    defaultValues: { score: 5, comment: '' },
  });

  const score = form.watch('score');

  const onSubmit = form.handleSubmit((values) => {
    submitRating.mutate(
      {
        id: orderId,
        input: { score: values.score, ...(values.comment ? { comment: values.comment } : {}) },
      },
      {
        onSuccess: () => {
          toast.success(t('orders.rating.success'));
          form.reset();
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t('orders.card.rate')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('orders.rating.title', { name: rateeName })}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormError
            message={submitRating.isError ? errorMessage(submitRating.error) : undefined}
          />

          <fieldset>
            <legend className="text-sm font-medium">{t('orders.rating.scoreLabel')}</legend>
            <div
              className="mt-2 flex gap-1"
              role="radiogroup"
              aria-label={t('orders.rating.scoreLabel')}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={score === value}
                  aria-label={String(value)}
                  onClick={() => form.setValue('score', value, { shouldValidate: true })}
                  className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={
                      value <= score
                        ? 'size-7 fill-current text-accent'
                        : 'size-7 text-muted-foreground'
                    }
                  />
                </button>
              ))}
            </div>
          </fieldset>

          <FormField
            id="rating-comment"
            label={t('orders.rating.commentLabel')}
            optionalLabel={t('orders.rating.commentOptionalLabel')}
          >
            <Textarea rows={3} {...form.register('comment')} />
          </FormField>

          <DialogFooter>
            <Button type="submit" disabled={submitRating.isPending}>
              {submitRating.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {submitRating.isPending ? t('orders.rating.submitting') : t('orders.rating.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
