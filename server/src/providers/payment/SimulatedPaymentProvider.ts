import { randomUUID } from 'node:crypto';
import { logger } from '../../config/logger';
import type { EscrowChargeRequest, EscrowChargeResult, PaymentProvider } from './types';

/**
 * Development/demo provider: always succeeds, instantly, with no real money
 * moving. Logs the charge so the flow is visible without a payment gateway.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated' as const;

  async chargeEscrow(request: EscrowChargeRequest): Promise<EscrowChargeResult> {
    const reference = `sim-${randomUUID()}`;
    logger.info(
      { orderId: request.orderId, amount: request.amount, reference },
      `[payment] Simulated escrow charge of ₹${request.amount} for order ${request.orderId}`,
    );
    return { success: true, reference };
  }
}
