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
```

Keep `VITE_KROMA_API_BASE_URL` pointed at the standalone web backend, not the
mobile app backend. The web backend forwards image generation to its own
`WEB_IMAGE_API_BASE_URL`. Production builds do not fall back to mock image
generation.

Backend setup details are in `web-backend/README.md`.

After Render deploys both services, verify the live backend is on the current
commit and has the required environment variables and Supabase tables:

```bash
npm run check:production
```

If this reports the old health format, redeploy `kroma-web-api` on Render before
testing signup, payment, or credit balance behavior.
