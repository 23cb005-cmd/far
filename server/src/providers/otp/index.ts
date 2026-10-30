import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ConsoleOtpProvider } from './ConsoleOtpProvider';
import type { OtpProvider } from './types';

export * from './types';
export { ConsoleOtpProvider };

let provider: OtpProvider | null = null;

/**
 * Resolve the configured OTP transport.
 *
 * `twilio` is accepted by the env schema because Phase 5 adds the real
 * provider; until then it falls back to the console provider with a warning
 * rather than failing a farmer's verification attempt.
 */
export function getOtpProvider(): OtpProvider {
  if (provider) return provider;

  switch (env.OTP_PROVIDER) {
    case 'twilio':
      logger.warn(
        'OTP_PROVIDER=twilio is not implemented until Phase 5; using the console provider',
      );
      provider = new ConsoleOtpProvider();
      break;
    case 'console':
    default:
      provider = new ConsoleOtpProvider();
      break;
  }

  return provider;
}

/** Test seam: force a specific provider. */
export function setOtpProvider(next: OtpProvider | null): void {
  provider = next;
}
