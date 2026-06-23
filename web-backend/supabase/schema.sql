create table if not exists public.web_users (
  id uuid primary key,
  email text not null,
  credits integer not null default 5,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.web_credit_transactions (
  id bigserial primary key,
  user_id uuid not null references public.web_users(id) on delete cascade,
  amount integer not null,
  type text not null,
  description text,
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.web_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.web_users(id) on delete set null,
  status text not null default 'pending',
  module text,
  prompt text,
  input_image_url text,
  result_image_url text,
  credits_cost integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.web_auth_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  type text not null,
  code text not null,
  provider_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists web_auth_codes_lookup_idx
on public.web_auth_codes (email, type, code, expires_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists web_users_touch_updated_at on public.web_users;
create trigger web_users_touch_updated_at
before update on public.web_users
for each row execute function public.touch_updated_at();

drop trigger if exists web_generations_touch_updated_at on public.web_generations;
create trigger web_generations_touch_updated_at
before update on public.web_generations
for each row execute function public.touch_updated_at();

alter table public.web_users enable row level security;
alter table public.web_credit_transactions enable row level security;
alter table public.web_generations enable row level security;
alter table public.web_auth_codes enable row level security;

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
