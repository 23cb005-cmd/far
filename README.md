# FarmFair

**Know the real price. Sell at a fair price.**

Fair price discovery and a trusted marketplace for Tamil Nadu farmers and crop
buyers. Farmers see today's official mandi rates, list their crop, compare
openly-labelled offers, and get paid through escrow.

> **Status: Phase 1 complete** — foundation, security and authentication.
> Later phases add mandi prices, the marketplace, escrow orders, notifications,
> a WhatsApp bot and the admin panel. Full documentation lands in Phase 8.

## Stack

| Layer    | Technology                                                                              |
| -------- | --------------------------------------------------------------------------------------- |
| Client   | Vite, React 18, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand, react-i18next |
| Server   | Node 20, Express, TypeScript, Mongoose, Zod, Pino, argon2, JWT                          |
| Database | MongoDB 7 (single-node replica set, for transactions in Phase 4)                        |
| Tests    | Jest + Supertest + mongodb-memory-server (server), Vitest + Testing Library (client)    |

Three npm workspaces — `shared/` (Zod schemas, constants, types shared by both
sides), `server/`, `client/` — so validation rules cannot drift between the
client and the API.

## Getting started

Requires Node 20 (`.nvmrc`) and Docker.

```bash
# 1. install
npm install

# 2. start MongoDB (and mongo-express on http://localhost:8081, admin/admin)
docker compose up -d

# 3. configure the server
cp server/.env.example server/.env
# generate the two JWT secrets (must be at least 32 chars and must differ):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. run both apps
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000/api/v1
- API docs (development only): http://localhost:4000/api/docs
- Health: http://localhost:4000/api/v1/health

The server **refuses to start** on invalid configuration and prints exactly
which variables are wrong.

### Create an administrator

Admin accounts cannot be created through the public API. Use the CLI:

```bash
npm run create-admin
```

## Scripts

| Script                 | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Builds `shared`, then runs the server and client together |
| `npm run build`        | Builds all three workspaces                               |
| `npm run typecheck`    | `tsc --noEmit` across all workspaces                      |
| `npm run lint`         | ESLint (typescript-eslint, react, react-hooks, jsx-a11y)  |
| `npm test`             | Full test suite                                           |
| `npm run format`       | Prettier write                                            |
| `npm run create-admin` | Interactive admin creation                                |

A Husky pre-commit hook runs lint-staged (ESLint `--fix` + Prettier) on staged
files. GitHub Actions runs install, lint, typecheck, test and build on every
push and pull request.

## Environment variables

See [`server/.env.example`](server/.env.example) for the annotated list. The
required ones are:

| Variable             | Notes                                                     |
| -------------------- | --------------------------------------------------------- |
| `NODE_ENV`           | `development` \| `test` \| `production`                   |
| `PORT`               | Default `4000`                                            |
| `MONGODB_URI`        | Must be a `mongodb://` or `mongodb+srv://` URI            |
| `CLIENT_URL`         | The only allowed CORS origin; must be https in production |
| `JWT_ACCESS_SECRET`  | ≥ 32 characters                                           |
| `JWT_REFRESH_SECRET` | ≥ 32 characters, must differ from the access secret       |
| `COOKIE_DOMAIN`      | Blank for localhost; parent domain in production          |

Everything else is optional and reserved for later phases (mandi prices,
uploads, payments, notifications, the WhatsApp bot).

## Security

- Passwords hashed with **argon2id** (19 MiB, 2 passes), never logged
- Access token 15 min, refresh token 7 days, both **httpOnly / SameSite=strict**,
  Secure in production; the refresh cookie is scoped to `/api/v1/auth`
- `tokenVersion` revocation: logout, password change or suspension invalidates
  every token already issued
- Account lockout: 15 minutes after 5 failed sign-ins; login errors are
  deliberately generic to prevent user enumeration
- Double-submit **CSRF** tokens on all state-changing requests
- Helmet with a strict CSP (no `unsafe-inline` scripts), HSTS in production
- Rate limits: auth 10 / 15 min per IP, OTP 3 / 15 min per phone, API 300 / 15 min
- `express-mongo-sanitize` + `hpp` + 100 kb body cap; Zod strips unknown fields
- Phone numbers masked in logs and the audit trail; tokens and passwords redacted
- Audit log for register, login success/failure, lockout, logout, password change

## Licence

MIT
