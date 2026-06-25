# Commerce Studio API Contracts

This document describes the current web product boundaries.

## Runtime Switches

Use the dedicated web account backend for auth, credits, and server-side credit
deduction:

```env
VITE_WEB_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
```

`VITE_KROMA_API_BASE_URL` must point at the standalone web backend. Do not point
the browser directly at the mobile app backend. The web backend proxies
`/image/*` requests to `WEB_IMAGE_API_BASE_URL`, currently the app image router
at `https://kroma-api.onrender.com/api/v1`. Web auth, credits, billing, and
Supabase remain isolated in `kroma-web-api`.

```env
VITE_KROMA_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
VITE_API_BASE_URL=
```

Automated Playwright checks run in mock generation mode and do not consume real
provider credits.

Production builds also publish `/version.json` from the static frontend. Use
`npm run check:production` after every Render deploy to verify both the frontend
commit and the backend `/api/v1/health` commit.

## Auth

`POST /api/v1/auth/signup`

Creates a Supabase web user signup token and sends a kroma 6 digit email code
through the configured email provider.

`POST /api/v1/auth/verify-signup`

Verifies the 6 digit public code. The frontend then returns the user to password
login instead of auto-logging in.

`POST /api/v1/auth/login`

Password login.

`POST /api/v1/auth/otp`

Sends a 6 digit email login code.

`POST /api/v1/auth/verify-code`

Verifies the login code and returns an access token.

The web backend never sends Supabase's native 8 digit OTP to users. It stores a
hashed copy of the public kroma 6 digit code in `web_auth_codes` and rejects raw
8 digit Supabase OTP input. `WEB_AUTH_CODE_SECRET` is recommended in production
for stable code hashing, but missing it does not block service startup because
the backend can fall back to existing server secrets.

After a successful password or email-code login, the frontend routes to the
account page. Logged-in navigation hides the Login entry, shows the current
account email on the account page, and provides a logout button that clears the
local web session.

## Credits

`GET /api/v1/user/credits`

Requires a bearer token. Creates an isolated web account record with 5 free
credits when the user logs in for the first time.

`POST /api/v1/user/credits/deduct`

Requires a bearer token. Supports success-only charging:

```text
/api/v1/user/credits/deduct?amount=2&task_status=completed&charge_policy=success_only
```

Failed tasks do not consume credits when `charge_policy=success_only`.

`POST /api/v1/user/credits/add`

Requires both a user bearer token and the server-only `X-Kroma-Billing-Key`
header. This endpoint is for webhook or internal billing reconciliation only and
must not be called from the browser.

## Billing

The frontend opens Paddle Checkout when `VITE_PADDLE_CLIENT_TOKEN` and the plan
price IDs are configured.

Paddle sends completed transactions to:

```text
POST /api/v1/billing/paddle/webhook
```

The webhook verifies `Paddle-Signature`, handles `transaction.completed`, reads
`custom_data.user_id` and `custom_data.credits`, credits the web account, and
records the event for idempotency.
If `custom_data.credits` is absent, the backend falls back to
`WEB_PADDLE_PRICE_CREDITS_JSON` and derives credits from the Paddle price id in
`data.items`.

If Paddle is not configured in production, the price page shows a payment
configuration error and does not create mock credits. Mock crediting is limited
to development and tests.

Paddle checkout requires the frontend `VITE_PADDLE_CLIENT_TOKEN` plus the six
plan price IDs. Webhook fulfillment requires `WEB_PADDLE_WEBHOOK_SECRET` and a
valid `WEB_PADDLE_PRICE_CREDITS_JSON` map on `kroma-web-api`.

## Generation

The frontend generation request shape remains:

```ts
{
  product: ProductInput;
  config: GenerationConfig & { resolution: "1K" | "2K" | "4K" };
  routeMode: "template" | "standard" | "edit_tool" | "hd";
  route: GenerationRoute;
  prompt: BuiltGenerationPrompt;
  billing: {
    estimatedCreditCost: number;
    chargePolicy: "success_only";
    creditBalanceBefore?: number;
  };
  client: {
    source: "commerce-studio-web";
    contractVersion: "2026-06-17";
  };
}
```

Route rules:

- Standard / template 1K: `RightCode -> Wuyinkeji -> PackyAPI -> GPTsAPI`
- Edit tool mode: `PackyAPI`
- HD / 2K / 4K: `Wuyinkeji HD -> RightCode HD -> GPTsAPI -> PackyAPI HD`

Failed generation responses must return `creditCost: 0`.
