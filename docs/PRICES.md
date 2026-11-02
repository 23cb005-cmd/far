# Mandi prices

FarmFair shows daily wholesale ("mandi") prices per crop, district and
market, sourced from [data.gov.in](https://www.data.gov.in/), India's open
government data portal.

## Getting an API key

1. Create a free account at <https://data.gov.in/>.
2. Generate an API key from your account page.
3. Set it in `server/.env`:

```
DATA_GOV_API_KEY=your-key-here
DATA_GOV_STATE=Tamil Nadu
```

## Without a key: sample mode

If `DATA_GOV_API_KEY` is unset, the server generates realistic sample
prices instead (`GeneratedMandiProvider`) — plausible modal/min/max prices
per crop and district, close enough to real rates for development and
demos without needing a key. Prices are tagged with their `source`
(`generated` vs the real provider) so the client/UI can distinguish them if
needed.

Even with a key configured, if a `data.gov.in` request fails or returns no
usable records for a given district/day, the server silently falls back to
the generated provider rather than showing an error — see
`server/src/providers/mandi/DataGovMandiProvider.ts`.

## Import behaviour

Prices are **not** imported on a fixed schedule. They're fetched and cached
**lazily**: the first time a district/date combination is requested (via
the prices or fair-price-check endpoints), the server calls the configured
provider, upserts the records into MongoDB, and every subsequent request
for that same district/date is served straight from the database. Fetching
a multi-day trend batches the underlying date range in groups of 5 to
avoid firing dozens of requests at once.

This means the first user to check prices for a given day is the one who
triggers the fetch — there's a small one-time latency, not a visible import
job. (The `priceAlerts` scheduled job, which runs daily and compares
today's price to yesterday's average to notify farmers of large moves,
relies on this same lazy-ingestion path having already populated both
days — see `server/src/jobs/priceAlerts.ts`.)
