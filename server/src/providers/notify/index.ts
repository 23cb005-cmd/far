import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { twilioConfigured } from '../twilio/client';
import { ConsoleNotifyProvider } from './ConsoleNotifyProvider';
import { TwilioWhatsAppProvider } from './TwilioWhatsAppProvider';
import type { NotifyProvider } from './types';

export * from './types';
export { ConsoleNotifyProvider, TwilioWhatsAppProvider };

let provider: NotifyProvider | null = null;

/**
 * Resolve the configured external notification transport.
 *
 * `telegram` is accepted by the env schema for a later phase that adds chat
 * linking; until then it falls back to the console provider with a warning
 * rather than failing a notification.
 */
export function getNotifyProvider(): NotifyProvider {
  if (provider) return provider;

  switch (env.NOTIFY_PROVIDER) {
    case 'twilio':
      if (twilioConfigured() && env.TWILIO_WHATSAPP_FROM) {
        provider = new TwilioWhatsAppProvider();
      } else {
        logger.warn(
          'NOTIFY_PROVIDER=twilio is missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM; using the console provider',
        );
        provider = new ConsoleNotifyProvider();
      }
      break;
    case 'telegram':
      logger.warn('NOTIFY_PROVIDER=telegram is not implemented yet; using the console provider');
      provider = new ConsoleNotifyProvider();
      break;
    case 'console':
    default:
      provider = new ConsoleNotifyProvider();
      break;
  }

  return provider;
}

/** Test seam: force a specific provider. */
export function setNotifyProvider(next: NotifyProvider | null): void {
  provider = next;
}
