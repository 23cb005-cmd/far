# E2E tests

Playwright suite covering the full order flow (list → offer → admin verifies
buyer → accept → pay → confirm pickup → rate) and admin moderation
(suspend/unsuspend - this codebase has no dispute flow to test instead, see
the comment in `tests/admin-moderation.spec.ts`).

```bash
npm run test:e2e        # from the repo root
```

`globalSetup` reseeds the database (`npm run seed -w server`) before every
run, so each run starts from the same known state and gets a fixed admin
login (`9000000001` / `farmfair1`).

## Rate limits

The suite drives several personas (farmer, buyer, admin) through real
login/register flows against one dev server, all from `localhost` - that's
more auth traffic from a single IP than the production-safe default
(`RATE_LIMIT_AUTH_MAX=10` per 15 min in `server/.env`) allows, and a run can
hit `429`s partway through even though nothing is actually broken.

CI's own job (`.github/workflows/ci.yml`, `e2e` job) writes a throwaway
`server/.env` with relaxed limits, so this only matters for local runs
against your own `server/.env`. To run the suite locally, temporarily raise
`RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_GENERAL_MAX` (e.g. to `1000` and
`100000`) and restart the dev server, then put them back afterward - don't
commit relaxed values.
