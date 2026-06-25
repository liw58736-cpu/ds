# Kroma Web Production Launch Checklist

Use this checklist before treating `https://kromaai.app` as live.

## 1. Deploy The Two Render Services

The web product uses two separate Render services:

- `kroma-web-api`: Node backend from `web-backend`
- `kroma-web`: static frontend from `dist`

Do not deploy this web product into the mobile app backend.

In Render, redeploy both services from the GitHub repository `liw58736-cpu/ds` on `main`.

After deploy, run:

```text
npm run check:production
```

Expected:

- `deployed backend commit` is `OK`
- `frontend version metadata` is `OK`
- `deployed frontend commit` is `OK`
- `required environment` is `OK`
- `required Supabase tables` is `OK`

If `https://kromaai.app/version.json` returns HTML, redeploy `kroma-web`. The local build already writes `dist/version.json`; HTML means the static site is still serving an old build or the custom domain points at the wrong service.

## Current Production Check Failures

Use this section when `npm run check:production` reports the current known
failure shape.

### `CHECK deployed backend commit`

The live `kroma-web-api` service is not running the latest backend-affecting
commit.

Fix:

1. Open Render dashboard.
2. Open service `kroma-web-api`.
3. Confirm it is connected to GitHub repository `liw58736-cpu/ds`, branch
   `main`, root directory `web-backend`.
4. Trigger a manual deploy from the latest commit.
5. Re-run `npm run check:production`.

### `CHECK frontend version metadata: missing or rewritten to HTML`

`https://kromaai.app/version.json` is returning the frontend HTML page instead
of JSON build metadata. This usually means the static service is serving an old
build, the static publish path is wrong, or the custom domain is attached to
the wrong service.

Fix:

1. Open Render service `kroma-web`.
2. Confirm it is a static site, not a web service.
3. Confirm build command is `npm ci && npm run build`.
4. Confirm static publish path is `./dist`.
5. Confirm custom domain `kromaai.app` is attached to `kroma-web`, not
   `kroma-web-api` or any placeholder service.
6. Trigger a manual deploy from the latest commit.
7. Open `https://kromaai.app/version.json`; it should show JSON with
   `service`, `commit`, and `built_at`.

### `CHECK deployed frontend commit`

The frontend static site is still serving an older commit than the current
GitHub `main` branch. This can happen when Render automatic deploy does not
start after a push.

Fix:

1. Open Render service `kroma-web`.
2. Click `Manual Deploy`.
3. Deploy the latest commit from branch `main`.
4. Wait until the deploy succeeds.
5. Re-run `npm run check:production`.

### `CHECK required environment: paddleWebhookSecret`

Paddle payment can open checkout, but completed payments cannot safely credit
the account until the webhook signature secret is configured.

Fix:

1. In Paddle, create or open the webhook destination:
   `https://kroma-web-api.onrender.com/api/v1/billing/paddle/webhook`.
2. Set the description to `kroma web Paddle webhook`.
3. Keep usage type as `Platform`.
4. Subscribe to `transaction.completed` only.
   - If Paddle opens the event list in a modal, the checkbox is on the far
     right of the `transaction.completed` row.
   - Do not save a destination with zero selected events.
5. Save the destination.
6. Copy the webhook signing secret.
7. Set `WEB_PADDLE_WEBHOOK_SECRET` on Render service `kroma-web-api`.
8. Redeploy `kroma-web-api`.

### `CHECK required environment: imageApiBaseUrl`

Real image generation is not ready until the web backend has an image upstream
configured. The current production choice is to reuse the mobile app image
router only for generation routing.

Fix:

1. Set `WEB_IMAGE_API_BASE_URL=https://kroma-api.onrender.com/api/v1` on
   `kroma-web-api`.
2. Leave `WEB_IMAGE_API_KEY` empty for the current app image router.
3. Redeploy `kroma-web-api`.
4. Run one authenticated generation smoke test after
   `npm run check:production` passes.

Important:

- The web product keeps auth, credits, Paddle billing, and Supabase isolated in
  `kroma-web-api`.
- `kroma-web-api` only proxies `/api/v1/image/*` to the app image router and
  does not forward the web user's bearer token to the app backend.

## 2. Required Backend Environment

Set these on Render service `kroma-web-api`:

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
WEB_IMAGE_API_BASE_URL=https://kroma-api.onrender.com/api/v1
WEB_IMAGE_API_KEY=
```

Optional but recommended:

```text
WEB_AUTH_CODE_SECRET=<generated-secret>
WEB_INTERNAL_BILLING_KEY=<generated-secret>
```

Generate server secrets locally:

```text
npm run secret:auth-code
npm run secret:internal-billing
```

`WEB_AUTH_CODE_SECRET` is recommended so email verification code hashing remains
stable across deploys. It does not block startup because the backend can fall
back to existing server-only secrets. `WEB_INTERNAL_BILLING_KEY` only protects
manual internal top-ups; Paddle checkout and webhook crediting do not require
it.

## 3. Paddle Webhook

Create a Paddle webhook endpoint:

```text
https://kroma-web-api.onrender.com/api/v1/billing/paddle/webhook
```

Subscribe to:

```text
transaction.completed
```

Copy the webhook signing secret into:

```text
WEB_PADDLE_WEBHOOK_SECRET
```

The frontend sends `customData.user_id`, `customData.plan_id`, `customData.plan_name`, and `customData.credits`. The backend verifies `Paddle-Signature`, credits once, and stores the event in `web_billing_events`.

## 4. Image Generation Upstream

Set the image upstream on `kroma-web-api`:

```text
WEB_IMAGE_API_BASE_URL=https://kroma-api.onrender.com/api/v1
WEB_IMAGE_API_KEY=
```

The browser calls `kroma-web-api`. The backend then proxies `/api/v1/image/*` to
`WEB_IMAGE_API_BASE_URL`. Do not point browser-facing frontend variables directly
at the mobile app backend.

## 5. Required Frontend Environment

Set these on Render service `kroma-web`:

```text
VITE_API_BASE_URL=
VITE_WEB_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
VITE_KROMA_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
VITE_PADDLE_ENVIRONMENT=production
VITE_PADDLE_CLIENT_TOKEN=<paddle-client-token>
VITE_PADDLE_PRICE_BASIC_TOP_UP=pri_01kvq85dsggpt3qcb5pk02s10a
VITE_PADDLE_PRICE_STANDARD_TOP_UP=pri_01kvq89wc6w551q949arne6xvt
VITE_PADDLE_PRICE_PRO_TOP_UP=pri_01kvq8cmj8xb0412zr80hracsp
VITE_PADDLE_PRICE_MONTHLY_SUBSCRIPTION=pri_01kvq8dppzzfbrbb5yqf15x7se
VITE_PADDLE_PRICE_QUARTERLY_SUBSCRIPTION=pri_01kvq8g8wwx973evrvc2dgcfad
VITE_PADDLE_PRICE_YEARLY_SUBSCRIPTION=pri_01kvq8f3masyt9nfcgs9zscrq5
```

## 6. Smoke Test

After `npm run check:production` passes:

1. Open `https://kromaai.app`.
2. Register with an email and confirm the 6 digit kroma code.
3. Log in and confirm the account page shows the user email and logout button.
4. Start Paddle checkout from the pricing page.
5. Complete a test purchase in Paddle production only when the account is ready for real payments.
6. Confirm credits increase after the `transaction.completed` webhook.
7. Run one real generation and confirm successful tasks deduct credits only after completion.
