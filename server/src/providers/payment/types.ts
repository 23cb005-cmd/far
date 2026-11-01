import type { PaymentProviderName } from '@farmfair/shared';

export interface EscrowChargeRequest {
  /** Our internal order id, so the provider's reference can be traced back. */
  orderId: string;
  /** Rupees. */
  amount: number;
  description: string;
}

export interface EscrowChargeResult {
  success: boolean;
  /** Provider's own reference for the payment, where one exists. */
  reference: string;
}

/**
 * Moves a buyer's payment into escrow for one order. Release to the farmer
 * is not a provider concern here: there are no bank/UPI payout details on a
 * `User` yet, so "release" is bookkeeping done by `orders.ts` when pickup is
 * confirmed, not a real transfer.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  chargeEscrow(request: EscrowChargeRequest): Promise<EscrowChargeResult>;
}
