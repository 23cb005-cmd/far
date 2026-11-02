# API

## Interactive docs

The full OpenAPI/Swagger UI is served by the server itself, in development
only:

```
http://localhost:4000/api/docs
```

The raw OpenAPI document is at `http://localhost:4000/api/docs.json`. It is
not exposed in production.

All routes are mounted under the `/api/v1` prefix (`API_PREFIX` in
`shared/src/constants.ts`).

## Auth flow

Authentication is cookie-based, not bearer-token-based — the client never
touches the JWTs directly.

1. **Register or log in** (`POST /api/v1/auth/register` or
   `POST /api/v1/auth/login`). On success the server sets two `httpOnly`
   cookies: a short-lived **access token** (15 min) and a longer-lived
   **refresh token** (7 days, scoped to the `/api/v1/auth` path only).
   Both are `SameSite=strict` and `Secure` in production.
2. **CSRF**: every state-changing request (`POST`/`PATCH`/`DELETE`, except
   webhooks) requires a CSRF token. Fetch one from
   `GET /api/v1/auth/csrf`, which returns the token and also sets it as a
   readable cookie; send it back on the `X-CSRF-Token` header. This is the
   standard double-submit pattern — the cookie alone doesn't authorize
   anything without a matching header.
3. **Refresh**: when the access token expires, call
   `POST /api/v1/auth/refresh` (cookie-authenticated) to get a new pair.
4. **Logout** (`POST /api/v1/auth/logout`) clears both cookies and bumps
   the user's `tokenVersion`, which invalidates every token issued before
   that point — not just the one being logged out.
5. **`GET /api/v1/auth/me`** returns the current user, or `401` if the
   session is invalid/expired.

Webhooks (`/api/v1/webhooks/*`, e.g. the Twilio WhatsApp webhook) are
exempt from CSRF — the caller isn't a browser and can't carry a CSRF
cookie. They're protected by request-signature verification instead (see
[`docs/WHATSAPP.md`](WHATSAPP.md)).

## Response format

Every response (success or error) is shaped the same way:

```ts
{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown; // e.g. per-field validation issues
  };
}
```

Validation failures (Zod) return `400` with `error.code = "VALIDATION_ERROR"`
and `error.details` as an array of `{ path, message }`. Mongoose duplicate
keys map to `409`. The server never includes a stack trace in a production
error response.
