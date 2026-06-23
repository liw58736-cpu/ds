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

The backend sends its own 6 digit signup and login codes through Resend. Supabase
still creates the underlying auth token, but users only see the kroma code.

## Render Environment

Set these values on the `kroma-web-api` service:

```text
WEB_SUPABASE_URL=https://<web-project-ref>.supabase.co
WEB_SUPABASE_ANON_KEY=<web-project-anon-key>
WEB_SUPABASE_SERVICE_ROLE_KEY=<web-project-service-role-key>
WEB_AUTH_REDIRECT_URL=https://kromaai.app
WEB_ALLOWED_AUTH_REDIRECTS=https://kromaai.app,https://www.kromaai.app,https://kroma-web.onrender.com
WEB_AUTH_EMAIL_FROM=kroma <no-reply@i18.pro>
WEB_RESEND_API_KEY=<resend-api-key>
WEB_INTERNAL_BILLING_KEY=<server-to-server-billing-secret>
```

`WEB_INTERNAL_BILLING_KEY` protects manual or webhook-driven credit top-ups. Do
not expose it to the frontend.

The frontend static service should use:

```text
VITE_WEB_API_BASE_URL=https://kroma-web-api.onrender.com/api/v1
VITE_KROMA_API_BASE_URL=
VITE_API_BASE_URL=
```

`VITE_KROMA_API_BASE_URL` is intentionally empty so the web frontend does not
call the mobile app backend for account or generation behavior.
