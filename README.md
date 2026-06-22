# kroma commerce studio

## Local frontend

```bash
npm install
npm run dev -- --port 4290
```

## Deploy with the Kroma backend

The frontend is configured for same-origin backend deployment with:

```env
VITE_KROMA_API_BASE_URL=/api/v1
```

Build the frontend and copy it into the FastAPI backend static site directory:

```bash
npm run deploy:kroma-backend
```

By default this deploys to:

```text
F:\ai图像生成app\backend\static\site
```

Override the target when needed:

```bash
KROMA_BACKEND_SITE_DIR=/path/to/backend/static/site npm run deploy:kroma-backend
```

After that, start the backend from `F:\ai图像生成app\backend`; the FastAPI app serves both the website and `/api/v1` routes.
