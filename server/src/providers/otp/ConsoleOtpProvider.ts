import { maskPhone } from '@farmfair/shared';
import { logger } from '../../config/logger';
import type { OtpMessage, OtpProvider, OtpSendResult } from './types';

/**
 * Development provider: prints the code to the server log instead of sending an
 * SMS, and returns it to the caller so the UI can prefill the field.
 *
 * `exposesCode` is what gates that behaviour, so wiring a real provider
 * automatically stops the code being returned over the API.
 */
export class ConsoleOtpProvider implements OtpProvider {
  readonly name = 'console';
  readonly exposesCode = true;

  async send(message: OtpMessage): Promise<OtpSendResult> {
    // The code goes in the message text, not a structured field: the logger
    // redacts a `code` property by design, and that rule should stay intact.
    logger.info(
      { to: maskPhone(message.to), expiresInMinutes: message.expiresInMinutes },
      `[OTP] Verification code for ${maskPhone(message.to)}: ${message.code}`,
    );
    return { delivered: true, reference: `console-${Date.now()}`, devCode: message.code };
  }
}
