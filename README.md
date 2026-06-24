# kroma commerce studio

## Local frontend

```bash
npm install
npm run dev -- --port 4290
```

For local account API testing, point the frontend at the standalone web backend:

```env
VITE_WEB_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_KROMA_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_API_BASE_URL=
```

## Web deployment

This website is deployed as two separate Render services:

- `kroma-web`: static frontend for `https://kromaai.app`
- `kroma-web-api`: standalone Node account and billing backend

The web product must not be deployed into `F:\ai图像生成app` or the mobile app backend. The mobile app and web product use separate Supabase projects, separate credit balances, and separate Render services.

Frontend production variables:

```env
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

Keep `VITE_KROMA_API_BASE_URL` pointed at the standalone web backend, not the
mobile app backend. The web backend forwards image generation to its own
`WEB_IMAGE_API_BASE_URL`. Production builds do not fall back to mock image
generation.

Backend setup details are in `web-backend/README.md`.

Every production build writes `version.json` into the static frontend. After
Render deploys both services, verify the live frontend and backend are on the
expected commits and that the backend has the required environment variables
and Supabase tables:

```bash
npm run check:production
```

The check must report:

- `OK deployed backend commit`
- `OK frontend version metadata`
- `OK deployed frontend commit`
- `OK required environment`
- `OK required Supabase tables`

If `frontend version metadata` says `missing or rewritten to HTML`, redeploy
`kroma-web` so the latest build publishes `/version.json`. If the backend commit
is old, redeploy `kroma-web-api` before testing signup, payment, or credit
balance behavior.
