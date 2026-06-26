# Kroma Web Backend

This backend is for the ecommerce web product only. It must use a separate
Supabase project from the mobile app.

## Required Supabase Setup

1. Create a new Supabase project, for example `kroma-web`.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Open Authentication > URL Configuration.
4. Set Site URL to `https://kromaai.app`.
5. Add Redirect URLs:
   - `https://kromaai.app`
   - `https://www.kromaai.app`
   - `https://kroma-web.onrender.com`
6. Open Authentication > Emails > SMTP Settings and enable custom SMTP.
7. Use a verified sender domain, for example `no-reply@i18.pro`.
8. Keep this web project separate from the mobile app Supabase project.

The backend sends its own 6 digit codes through Resend. Signup creates an
unconfirmed Supabase auth user, stores only the internal user id with the public
kroma code, and confirms the user after the 6 digit code is verified. Login code
sign-in still resolves the public kroma code to Supabase's internal one-time
token, but that internal token is never shown in the kroma email.

## Render Environment

The backend service should use the same pinned Node 24.x runtime as the
frontend. `render.yaml` sets `NODE_VERSION=24.14.1`, and
`web-backend/package.json` keeps the accepted engine range under Node 25.

Set these values on the `kroma-web-api` service:

```text
WEB_SUPABASE_URL=https://<web-project-ref>.supabase.co
WEB_SUPABASE_ANON_KEY=<web-project-anon-key>
WEB_SUPABASE_SERVICE_ROLE_KEY=<web-project-service-role-key>
WEB_AUTH_REDIRECT_URL=https://kromaai.app
WEB_ALLOWED_AUTH_REDIRECTS=https://kromaai.app,https://www.kromaai.app,https://kroma-web.onrender.com
WEB_AUTH_EMAIL_FROM=kroma <no-reply@i18.pro>
WEB_RESEND_API_KEY=<resend-api-key>
WEB_PADDLE_WEBHOOK_SECRET=<paddle-webhook-secret>
WEB_PADDLE_PRICE_CREDITS_JSON=<price-id-to-credit-json>
RIGHTCODE_BASE_URL=<rightcode-openai-compatible-base-url>
RIGHTCODE_KEY_1=<rightcode-key>
WUYINKEJI_BASE_URL=<wuyinkeji-base-url>
WUYINKEJI_KEY_1=<wuyinkeji-key>
PACKYAPI_BASE_URL=<packyapi-openai-compatible-base-url>
PACKYAPI_KEY_1=<packyapi-key>
GPTSAPI_BASE_URL=<gptsapi-openai-compatible-base-url>
GPTSAPI_KEY_1=<gptsapi-key>
```

Optional:

```text
WEB_AUTH_CODE_SECRET=<random-auth-code-hmac-secret>
WEB_INTERNAL_BILLING_KEY=<server-to-server-billing-secret>
RIGHTCODE_CONCURRENT=10
WUYINKEJI_CONCURRENT=10
PACKYAPI_CONCURRENT=10
GPTSAPI_CONCURRENT=10
PACKYAPI_IMAGE_MODEL=gpt-image-2
WEB_IMAGE_API_BASE_URL=<legacy-image-upstream-url>
WEB_IMAGE_API_KEY=<legacy-image-upstream-key-if-required>
```

`WEB_AUTH_CODE_SECRET` is used to hash public 6 digit email codes before storing
them in Supabase. Use a long random value and keep it stable after launch so
codes issued before a redeploy remain verifiable during their short lifetime.
It is recommended, but missing it does not block startup because the backend
can fall back to other server-only secrets. Generate one with:

```text
npm run secret:auth-code
```

`WEB_INTERNAL_BILLING_KEY` protects internal manual credit top-ups. Paddle
checkout and webhook crediting do not require it. Do not expose it to the
frontend. Generate one with:

```text
npm run secret:internal-billing
```

After deploying, open:

```text
https://kroma-web-api.onrender.com/api/v1/health
```

The response includes the deployed commit, a `missing` list for required
configuration, an `optionalMissing` list for non-blocking settings such as the
manual top-up key, and a `database` object that confirms whether required
Supabase tables are reachable. It only returns boolean status, never secret
values.

The root project also has:

```text
npm run check:production
```

That command checks both `kroma-web-api` and the static frontend
`https://kromaai.app/version.json`. Use it after every Render deploy.

## Paddle Webhook

Create a Paddle webhook endpoint:

```text
https://kroma-web-api.onrender.com/api/v1/billing/paddle/webhook
```

Subscribe at least to `transaction.completed`. The checkout frontend sends
`customData.user_id`, `customData.plan_id`, `customData.plan_name`, and
`customData.credits`; the webhook verifies the `Paddle-Signature`, applies the
credit top-up once, and stores the event in `web_billing_events` for idempotency.
If Paddle sends a later transaction without `customData.credits`, the backend
can derive credits from `WEB_PADDLE_PRICE_CREDITS_JSON` using the Paddle price
id in `data.items`.

The frontend static service should use:

```text
VITE_WEB_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
VITE_KROMA_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
VITE_API_BASE_URL=
VITE_PADDLE_ENVIRONMENT=production
VITE_PADDLE_CLIENT_TOKEN=<paddle-client-token>
VITE_PADDLE_PRICE_BASIC_TOP_UP=<paddle-price-id>
VITE_PADDLE_PRICE_STANDARD_TOP_UP=<paddle-price-id>
VITE_PADDLE_PRICE_PRO_TOP_UP=<paddle-price-id>
VITE_PADDLE_PRICE_MONTHLY_SUBSCRIPTION=<paddle-price-id>
VITE_PADDLE_PRICE_QUARTERLY_SUBSCRIPTION=<paddle-price-id>
VITE_PADDLE_PRICE_YEARLY_SUBSCRIPTION=<paddle-price-id>
```

`VITE_KROMA_API_BASE_URL` should point at the standalone web backend. The web
backend owns `/image/*` routing when any provider key is configured. Route order:

- Template mode and standard generation:
  `RightCode -> Wuyinkeji -> PackyAPI -> GPTsAPI`
- Edit tools:
  `PackyAPI`
- HD / 2K / 4K:
  `Wuyinkeji HD -> RightCode HD -> GPTsAPI -> PackyAPI HD`

Provider concurrency is controlled per provider with `*_CONCURRENT`; the default
is 10 per configured provider key. `WEB_IMAGE_API_BASE_URL` is kept only as a
legacy fallback for environments that have not yet configured the standalone web
provider pool. Do not point it at the mobile app backend for production web
generation.
