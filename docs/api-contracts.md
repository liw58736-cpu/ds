# Commerce Studio API Contracts

This document describes the current web product boundaries.

## Runtime Switches

Use the dedicated web account backend for auth, credits, and server-side credit
deduction:

```env
VITE_WEB_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
```

`VITE_KROMA_API_BASE_URL` must stay empty unless a separate web image generation
backend is configured. Do not point the web product at the mobile app backend.
When this value is empty in production, generation fails with a clear
configuration message instead of creating mock images.

```env
VITE_KROMA_API_BASE_URL=
VITE_API_BASE_URL=
```

Automated Playwright checks run in mock generation mode and do not consume real
provider credits.

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

If Paddle is not configured in production, the price page shows a payment
configuration error and does not create mock credits. Mock crediting is limited
to development and tests.

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
