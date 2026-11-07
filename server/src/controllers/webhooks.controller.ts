import { maskPhone, normalisePhone } from '@farmfair/shared';
import type { Request, Response } from 'express';
import Twilio from 'twilio';
import { logger } from '../config/logger';
import { InboundMessage } from '../models/InboundMessage';
import { handleInboundMessage } from '../services/bot';
import { asyncHandler } from '../utils/asyncHandler';

interface TwilioWhatsAppBody {
  From?: string;
  Body?: string;
  MessageSid?: string;
}

function sendTwiml(res: Response, message: string): void {
  const response = new Twilio.twiml.MessagingResponse();
  if (message) response.message(message);
  res.type('text/xml').send(response.toString());
}

/**
 * POST /webhooks/twilio/whatsapp
 *
 * Signature verified and rate limited by the middleware chain in
 * `routes/webhooks.routes.ts`; this handler only has to be idempotent and
 * fast. There is no slow step in `handleInboundMessage` (everything it does
 * is a handful of local database calls), so - unlike the general webhook
 * guidance to "respond first, work after" - awaiting it before replying
 * stays comfortably within Twilio's response window.
 */
export const twilioWhatsAppWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as TwilioWhatsAppBody;
  const messageSid = body.MessageSid;
  const text = body.Body ?? '';
  const phone = normalisePhone((body.From ?? '').replace(/^whatsapp:/, ''));

  if (!messageSid || !phone) {
    sendTwiml(res, '');
    return;
  }

  // Claim the MessageSid before processing. Checking first and inserting
  // afterwards allows two concurrent Twilio retries to execute the command
  // twice before either request has written its log record.
  try {
    await InboundMessage.create({
      phone: maskPhone(phone),
      body: text.slice(0, 1000),
      messageSid,
      outcome: 'processing',
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      sendTwiml(res, '');
      return;
    }
    throw error;
  }

  let reply: string;
  let outcome = 'ok';
  try {
    reply = await handleInboundMessage(phone, text);
  } catch (error) {
    outcome = 'error';
    logger.error({ err: (error as Error).message }, '[bot] failed to handle an inbound message');
    reply = 'Something went wrong. Please try again.';
  }

  await InboundMessage.updateOne({ messageSid }, { $set: { outcome } }).exec();

  sendTwiml(res, reply);
});
