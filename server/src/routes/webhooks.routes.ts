import { Router } from 'express';
import { twilioWhatsAppWebhookHandler } from '../controllers/webhooks.controller';
import { botLimiter } from '../middleware/rateLimit';
import { verifyTwilioSignature } from '../middleware/twilioWebhook';

export const webhooksRouter = Router();

// No CSRF: Twilio is not a browser and cannot carry a CSRF token. The
// signature check below is the equivalent protection (see `skipCsrf` in
// `app.ts`, and `middleware/twilioWebhook.ts`).
webhooksRouter.post(
  '/twilio/whatsapp',
  botLimiter,
  verifyTwilioSignature,
  twilioWhatsAppWebhookHandler,
);
