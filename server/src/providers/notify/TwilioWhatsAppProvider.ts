import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getTwilioClient, toWhatsAppAddress } from '../twilio/client';
import type { NotifyProvider, NotifySendResult, WhatsAppMessage } from './types';

/** Real transport: sends the WhatsApp message via the Twilio REST API. */
export class TwilioWhatsAppProvider implements NotifyProvider {
  readonly name = 'twilio';

  async sendWhatsApp(message: WhatsAppMessage): Promise<NotifySendResult> {
    try {
      const result = await getTwilioClient().messages.create({
        from: toWhatsAppAddress(env.TWILIO_WHATSAPP_FROM!),
        to: toWhatsAppAddress(message.to),
        body: message.body,
      });
      return { delivered: true, reference: result.sid };
    } catch (error) {
      logger.error({ err: (error as Error).message }, '[notify] Twilio WhatsApp send failed');
      return { delivered: false };
    }
  }
}
