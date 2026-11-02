# WhatsApp bot

Farmers without the web app can check prices, list a crop, and manage
offers/orders entirely over WhatsApp. The bot understands both English and
Tamil commands. See [`docs/USER_GUIDE.md`](USER_GUIDE.md) for the command
list from a farmer's point of view.

## Local development: Twilio sandbox

1. Create a free [Twilio](https://www.twilio.com/) account and open the
   WhatsApp sandbox (Messaging → Try it out → Send a WhatsApp message).
2. From your WhatsApp, send the sandbox's join code (e.g. `join
some-word`) to the sandbox number shown on that page. This links your
   phone to the sandbox for testing.
3. Set these in `server/.env`:

   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # the sandbox number
   NOTIFY_PROVIDER=twilio
   ```

4. Expose your local server with [ngrok](https://ngrok.com/) (or similar)
   so Twilio can reach it:

   ```
   ngrok http 4000
   ```

5. Set `PUBLIC_BASE_URL` in `server/.env` to the ngrok HTTPS URL, and
   configure that same URL as the sandbox's webhook in the Twilio console,
   pointing at:

   ```
   POST {PUBLIC_BASE_URL}/api/v1/webhooks/twilio/whatsapp
   ```

6. Message the sandbox number from your phone. Replies come back through
   the same webhook.

No Twilio account? Set `OTP_PROVIDER=console` and `NOTIFY_PROVIDER=console`
(the defaults) and use the `/dev/bot` simulator endpoint (non-production
only) to exercise the bot's command parsing without a real WhatsApp
account.

## Security

Inbound webhook requests are verified against Twilio's request signature
(`server/src/middleware/twilioWebhook.ts`) rather than CSRF — Twilio is a
server, not a browser, and can't carry a CSRF cookie. The webhook route is
also rate-limited per sender and de-duplicated on Twilio's `MessageSid`, so
a retried delivery doesn't double-process a command.

## Moving to production

1. Twilio WhatsApp requires a verified **Meta Business** account before you
   can message users outside the sandbox.
2. Any message your business sends to start a conversation (rather than
   reply within 24h of an inbound message) must use a pre-approved
   **message template** — plan for Meta's template review turnaround
   before launch.
3. Point the production webhook at your real `PUBLIC_BASE_URL` (your
   deployed API's public HTTPS URL), not an ngrok tunnel.
4. Use a real WhatsApp Business number instead of the sandbox number for
   `TWILIO_WHATSAPP_FROM`.

## Telegram

`TELEGRAM_BOT_TOKEN` exists as a reserved environment variable, and
`'telegram'` is listed as a notification channel value, but there is no
Telegram provider implemented — it's unused today. Treat it as a future
option, not a working alternative.

## Cost notes

Twilio prices WhatsApp by conversation (a 24-hour window opened either by
the user messaging first, or by your business sending a template to start
one), with per-conversation rates that vary by country and conversation
category (user-initiated vs business-initiated/template). Check Twilio's
current WhatsApp pricing page for your target country before estimating
cost at scale — don't assume sandbox testing is representative of
production pricing.
