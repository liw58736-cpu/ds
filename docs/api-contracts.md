# Commerce Studio API Contracts

This document describes the frontend contract that the current mock backend adapter already follows.

## Runtime Switch

Set `VITE_API_BASE_URL` to enable real backend mode:

```env
VITE_API_BASE_URL=https://api.example.com
```

When the value is empty, the frontend uses the local mock backend adapter.

Set `VITE_KROMA_API_BASE_URL` in `.env.development` when only the image
generation call should use the reference image backend from `F:\ai图像生成app`:

```env
VITE_KROMA_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

This sends generation requests to the async reference backend flow:

- `POST /image/generate`
- `GET /image/task/{taskId}` until `done` or `error`

Local task history, account, pricing, and legal-page behavior stay unchanged
unless `VITE_API_BASE_URL` is also configured.

Automated Playwright checks start Vite in `test` mode so they keep using the mock
generation path and do not consume real provider credits.

## Account

`POST /api/account/session`

Request body:

```ts
{
  identifier: string;
  authView: "login" | "register";
  mode: "code" | "password";
  storeName: string;
  inviteCode: string;
  createdAt: string;
}
```

Response shape:

```ts
{
  session: AccountSession | null;
  balance: number;
  transactions: CreditTransaction[];
}
```

`GET /api/account/current?accountId=guest`

Returns the same `AccountSnapshot` shape.

`POST /api/account/credits/consume`

Request body:

```ts
{
  amount: number;
  label: string;
  chargePolicy: "success_only";
}
```

Returns the updated `AccountSnapshot`.

## Billing

`POST /api/billing/checkouts`

Request body:

```ts
{
  planId: string;
  planName: string;
  credits: number;
  paymentChannel: "mock";
  note: string;
  currency: "CNY";
}
```

Response shape:

```ts
{
  orderId: string;
  status: "paid";
  creditedAmount: number;
  account: AccountSnapshot;
}
```

## Generation

`POST /api/generation/tasks`

Request body:

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

Kroma-compatible generation adapter:

- Frontend request stays in the `/api/generation/tasks` shape.
- The adapter posts to `/image/generate`, then polls `/image/task/{taskId}`.
- `main_image` and `detail_page` map to `task_type: "ecommerce"`.
- `white_background` maps to `task_type: "image_edit"` so the reference router
  uses its edit-tool path.
- `1K`, `2K`, and `4K` map to the reference backend quality values
  `standard`, `2k`, and `4k`.
- Failed reference-backend responses return `creditCost: 0`.
- The frontend remains in processing state while the reference task is still
  `pending` or `processing`.

Response shape:

```ts
{
  taskId: string;
  status: "completed" | "failed";
  resultUrls: string[];
  creditCost: number;
  routeMode: "template" | "standard" | "edit_tool" | "hd";
  errorCode?: string;
  errorMessage?: string;
}
```

## History

`GET /api/generation/tasks?accountId=guest`

Response shape:

```ts
GenerationTask[]
```

Charging remains success-only: failed generation tasks return `creditCost: 0` and should not deduct credits.
