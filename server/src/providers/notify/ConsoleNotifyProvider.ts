import { maskPhone } from '@farmfair/shared';
import { logger } from '../../config/logger';
import type { NotifyProvider, NotifySendResult, WhatsAppMessage } from './types';

/** Development/demo provider: prints the message to the server log instead of sending it. */
export class ConsoleNotifyProvider implements NotifyProvider {
  readonly name = 'console';

  async sendWhatsApp(message: WhatsAppMessage): Promise<NotifySendResult> {
    logger.info(
      { to: maskPhone(message.to) },
      `[notify] WhatsApp to ${maskPhone(message.to)}: ${message.body}`,
    );
    return { delivered: true, reference: `console-${Date.now()}` };
  }
}
