import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { twilioConfigured } from '../twilio/client';
import { ConsoleOtpProvider } from './ConsoleOtpProvider';
import { TwilioOtpProvider } from './TwilioOtpProvider';
import type { OtpProvider } from './types';

export * from './types';
export { ConsoleOtpProvider, TwilioOtpProvider };

let provider: OtpProvider | null = null;

/**
 * Resolve the configured OTP transport.
 *
 * `twilio` sends the code over WhatsApp using the same account as the notify
 * provider; without `TWILIO_WHATSAPP_FROM` configured it falls back to the
 * console provider with a warning rather than failing a farmer's
 * verification attempt.
 */
export function getOtpProvider(): OtpProvider {
  if (provider) return provider;

  switch (env.OTP_PROVIDER) {
    case 'twilio':
      if (twilioConfigured() && env.TWILIO_WHATSAPP_FROM) {
        provider = new TwilioOtpProvider();
      } else {
        logger.warn(
          'OTP_PROVIDER=twilio is missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM; using the console provider',
        );
        provider = new ConsoleOtpProvider();
      }
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
