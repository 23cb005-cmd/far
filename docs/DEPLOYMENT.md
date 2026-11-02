# Deployment

The default path: MongoDB Atlas (database), Render (API), Vercel (client).
`docker-compose.prod.yml` is also provided for self-hosting all three
yourself.

## 1. MongoDB Atlas

1. Create a free (M0) cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Add a database user and allow network access from Render's IPs (or
   `0.0.0.0/0` for simplicity on the free tier — tighten later).
3. Copy the connection string; it looks like
   `mongodb+srv://user:pass@cluster.mongodb.net/farmfair?retryWrites=true&w=majority`.
   This is your `MONGODB_URI`.

## 2. API on Render

`render.yaml` at the repo root is a [Render Blueprint](https://render.com/docs/blueprint-spec)
for the server only — connect the repo in the Render dashboard
("New → Blueprint") and it's auto-detected.

- **Build**: `npm ci && npm run build -w shared && npm run build -w server`
- **Start**: `npm run start -w server`
- **Health check**: `/api/v1/health`
- Every secret (`MONGODB_URI`, `CLIENT_URL`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, Razorpay/Twilio keys, etc.) is
  marked `sync: false` in the blueprint — Render prompts for these during
  setup rather than reading them from the repo.

**Single-instance caution**: `node-cron` (used for the `expireListings` /
`priceAlerts` / `cleanup` jobs) has no distributed lock. If you scale the
API to more than one instance, `JOBS_ENABLED` must stay `true` on **at
most one** of them — otherwise every job runs multiple times (duplicate
notifications, listings expired twice, etc). Either keep a single instance,
or set `JOBS_ENABLED=false` everywhere and trigger jobs from one separate
process (e.g. Render's own Cron Jobs feature calling
`npm run job -- <jobName>`).

## 3. Client on Vercel

`vercel.json` in the repo root configures:

- **Build**: `npm run build -w shared && npm run build -w client`
- **Output**: `client/dist`
- **Rewrites**: `/api/*` proxies to your deployed API (via the
  `VITE_API_PROXY_TARGET` environment variable — set this to your Render
  API's base URL, e.g. `https://farmfair-api.onrender.com`); everything
  else falls back to `index.html` for client-side routing.

Set `VITE_API_PROXY_TARGET` in the Vercel project's environment variables.

## 4. Custom domain + HTTPS

Both Render and Vercel provision HTTPS automatically for custom domains —
add the domain in each dashboard and follow their DNS instructions (CNAME
or A record). No manual certificate management needed on either platform.

## 5. Cookie domain for separate client/API domains

The API sets the access/refresh JWT cookies and the CSRF cookie with
`COOKIE_DOMAIN` (see `server/src/config/env.ts` and the cookie options in
`server/src/services/tokens.ts`). When the client and API are on different
subdomains of the same parent domain (e.g. `app.farmfair.in` and
`api.farmfair.in`), set:

```
COOKIE_DOMAIN=.farmfair.in
```

so the browser attaches the cookies to requests against both subdomains.
Leave it blank for `localhost` development, where client and API share an
origin through the Vite dev proxy and no explicit domain is needed. If
`COOKIE_DOMAIN` is wrong (e.g. doesn't match either domain, or is set when
client/API share an exact origin), login will appear to succeed but
`/auth/me` will fail because the browser won't send the cookie back.

`CLIENT_URL` must also be set to the client's exact origin — it's the only
origin the server's CORS policy allows, and in production it must be
`https://`.

## Self-hosting with Docker

`server/Dockerfile` and `client/Dockerfile` are multi-stage, non-root
production builds. `docker-compose.prod.yml` wires up MongoDB, the server
and the client together, reading secrets from an `.env` file rather than
inlining them:

```bash
cp server/.env.example .env   # fill in production values
docker compose -f docker-compose.prod.yml up -d --build
```

This is a self-hosting path (your own VM, a Docker-capable host) — for the
managed path above (Atlas + Render + Vercel) you don't need Docker at all.
