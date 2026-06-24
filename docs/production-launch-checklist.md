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
WEB_AUTH_CODE_SECRET=<generated-secret>
WEB_PADDLE_WEBHOOK_SECRET=<paddle-webhook-secret>
WEB_PADDLE_PRICE_CREDITS_JSON=<price-id-to-credit-json>
WEB_IMAGE_API_BASE_URL=<dedicated-web-image-upstream>
WEB_IMAGE_API_KEY=<dedicated-web-image-upstream-key>
```

Optional but recommended:

```text
WEB_INTERNAL_BILLING_KEY=<generated-secret>
```

Generate server secrets locally:

```text
npm run secret:auth-code
npm run secret:internal-billing
```

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

Set the dedicated web image upstream on `kroma-web-api`:

```text
WEB_IMAGE_API_BASE_URL=<dedicated-web-image-upstream>
WEB_IMAGE_API_KEY=<dedicated-web-image-upstream-key>
```

The browser calls `kroma-web-api`. The backend then proxies `/api/v1/image/*` to `WEB_IMAGE_API_BASE_URL`. Do not point browser-facing frontend variables directly at the mobile app backend.

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
