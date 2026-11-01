import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { SimulatedPaymentProvider } from './SimulatedPaymentProvider';
import type { PaymentProvider } from './types';

export * from './types';
export { SimulatedPaymentProvider };

let provider: PaymentProvider | null = null;

/**
 * Resolve the configured escrow payment transport.
 *
 * `razorpay` is accepted by the env schema for when a later phase adds the
 * real gateway; until then it falls back to the simulated provider with a
 * warning rather than failing every checkout.
 */
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  switch (env.PAYMENT_PROVIDER) {
    case 'razorpay':
      logger.warn('PAYMENT_PROVIDER=razorpay is not implemented yet; using the simulated provider');
      provider = new SimulatedPaymentProvider();
      break;
    case 'simulated':
    default:
      provider = new SimulatedPaymentProvider();
      break;
  }

  return provider;
}

/** Test seam: force a specific provider. */
export function setPaymentProvider(next: PaymentProvider | null): void {
  provider = next;
}
