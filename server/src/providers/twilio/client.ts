import Twilio from 'twilio';
import { env } from '../../config/env';

/** True once an account sid and auth token are both present in `.env`. */
export function twilioConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
}

export function toWhatsAppAddress(value: string): string {
  const address = value.trim();
  return /^whatsapp:/i.test(address) ? `whatsapp:${address.slice(9)}` : `whatsapp:${address}`;
}

let client: ReturnType<typeof Twilio> | null = null;

/**
 * Shared Twilio REST client, used by both the OTP provider (verification
 * codes) and the notify provider (WhatsApp alerts) - one account, one place
 * that constructs it.
 */
export function getTwilioClient(): ReturnType<typeof Twilio> {
  if (!twilioConfigured()) {
    throw new Error('Twilio is not configured: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  }
  client ??= Twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
  return client;
}

/** Test seam. */
export function setTwilioClient(next: ReturnType<typeof Twilio> | null): void {
  client = next;
}
