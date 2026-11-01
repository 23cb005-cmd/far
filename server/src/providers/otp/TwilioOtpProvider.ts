import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getTwilioClient } from '../twilio/client';
import type { OtpMessage, OtpProvider, OtpSendResult } from './types';

function otpText(message: OtpMessage): string {
  return message.language === 'ta'
    ? `உங்கள் FarmFair சரிபார்ப்பு குறியீடு: ${message.code} (${message.expiresInMinutes} நிமிடங்களில் காலாவதியாகும்)`
    : `Your FarmFair verification code is ${message.code} (expires in ${message.expiresInMinutes} minutes)`;
}

/**
 * Real transport: sends the OTP over WhatsApp via Twilio, since
 * `TWILIO_WHATSAPP_FROM` is the only sender number configured for this app -
 * there is no separate plain-SMS sender reserved.
 */
export class TwilioOtpProvider implements OtpProvider {
  readonly name = 'twilio';
  readonly exposesCode = false;

  async send(message: OtpMessage): Promise<OtpSendResult> {
    try {
      const result = await getTwilioClient().messages.create({
        from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${message.to}`,
        body: otpText(message),
      });
      return { delivered: true, reference: result.sid };
    } catch (error) {
      logger.error({ err: (error as Error).message }, '[otp] Twilio send failed');
      return { delivered: false };
    }
  }
}
