# n8n workflows for FarmFair

Three importable n8n workflows, built to **reuse FarmFair's existing API and
business logic** rather than duplicate it in n8n:

| File                                | What it does                                                                                 | Reuses                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `phase1-mandi-price-ingestion.json` | Daily (6am) schedule that calls `GET /api/v1/prices/today` for every Tamil Nadu district     | FarmFair's existing lazy fetch-and-cache logic (`docs/PRICES.md`)      |
| `phase2-price-alerts.json`          | Daily (7am) schedule that calls `POST /api/v1/admin/jobs/priceAlerts/run`                    | The existing `priceAlerts` job (`server/src/jobs/priceAlerts.ts`)      |
| `phase3-whatsapp-price-bot.json`    | Webhook that answers a `price <crop>` WhatsApp message by calling `GET /api/v1/prices/today` | Nothing server-side — this is a **separate, minimal** bot (see caveat) |

None of these write directly to MongoDB or reimplement data.gov.in fetching /
threshold comparisons — they drive FarmFair's own API, the same way the web
client does.

## Why the workflows look the way they do

FarmFair's API uses **httpOnly cookie auth + double-submit CSRF**, not a bearer
API key (see `README.md` → Security). So each workflow:

1. `GET /api/v1/auth/csrf` → reads `csrfToken` from the JSON body and the
   `ff_csrf` cookie from the raw `Set-Cookie` response header.
2. `POST /api/v1/auth/login` with `x-csrf-token` + `Cookie: ff_csrf=...`
   headers set from step 1 → reads the `ff_access` cookie back out of
   _that_ response's `Set-Cookie` header.
3. Every subsequent call sends `Authorization: Bearer <ff_access value>`
   (the server explicitly accepts Bearer tokens for non-browser clients —
   see `server/src/services/tokens.ts`).

GET requests (price checks) only need the bearer token. POST requests
(running an admin job) need a **fresh** CSRF token+cookie pair fetched
_after_ login, because login rotates the CSRF cookie.

This is handled by small **Code** nodes in each workflow — open them in n8n
to see exactly what's happening; nothing is hidden behind a credential type.

## Setup

1. Open n8n (http://localhost:5678) → **Workflows → Import from File** → pick
   each `.json` file.
2. In each workflow's **Config** node, replace the placeholder values:
   - `apiBase` — your FarmFair API URL (`http://localhost:4000` for local
     dev; use the server's reachable address if n8n runs elsewhere, e.g. in
     Docker you may need `http://host.docker.internal:4000`).
   - **Phase 1 / 3**: `farmerPhone` / `servicePhone` + password — any
     account works for read-only price checks. Use a seeded account (`npm
run seed` prints a credentials table) or register one.
   - **Phase 2**: `adminPhone` / `adminPassword` — must be an **admin**
     account (`npm run create-admin`), since only admins can hit
     `/admin/jobs/:name/run`.
3. Run each workflow once manually (▶ in the editor) to verify it works
   before activating the schedule/webhook.
4. Toggle **Active** once verified.

### Phase 3 extra step: Twilio

Point your Twilio WhatsApp sandbox/number webhook at this workflow's
**Production URL** (shown on the Webhook node) instead of FarmFair's own
`/api/v1/webhooks/twilio/whatsapp` endpoint — the two are alternatives, not
chained. If you want FarmFair's existing bot (full bilingual command set)
instead, leave Twilio pointed at FarmFair directly and ignore Phase 3; see
`docs/WHATSAPP.md`.

## Known limitations

- **Phase 3 has no Twilio signature verification.** FarmFair's own webhook
  verifies `X-Twilio-Signature` (`server/src/middleware/twilioWebhook.ts`);
  this starter workflow does not, so anyone who finds the webhook URL could
  post fake messages. Add an HMAC-SHA1 check (Twilio auth token + URL +
  sorted form params) in a Code node before using this beyond local testing.
- **Phase 3 only understands `price <crop>`.** It's a starting point, not
  parity with FarmFair's existing WhatsApp bot (listing crops, managing
  offers/orders, Tamil support — see `docs/USER_GUIDE.md`). Extend the
  `Parse Twilio Message` / `Is price command?` nodes to add more commands.
- **Each Phase 3 message re-logs-in.** Fine for occasional use; for higher
  volume, cache the access token (e.g. in n8n's static data or an external
  store) and only re-login when a call returns 401.
- These workflows were authored by reading the FarmFair server source and
  have **not been executed end-to-end** in this environment (no running
  MongoDB/server instance was available). Verify each one manually before
  activating, and check the HTTP Request nodes' actual response shape in
  n8n's execution view if anything doesn't match — exact JSON key names for
  "full response" mode can shift slightly between n8n versions.
