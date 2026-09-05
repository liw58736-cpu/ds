-- Additive migration. Existing balances and purchased entitlements are preserved.
alter table public.web_users add column if not exists reserved_credits integer not null default 0;

create table if not exists public.web_image_jobs (
  id text primary key,
  user_id uuid not null references public.web_users(id),
  request_id text not null,
  group_id text not null,
  payload jsonb not null,
  cost integer not null check(cost >= 0),
  status text not null default 'queued' check(status in ('queued','processing','done','error')),
  result jsonb,
  settled boolean not null default false,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_id)
);
create index if not exists web_image_jobs_user_group_idx on public.web_image_jobs(user_id,group_id,created_at);
create index if not exists web_image_jobs_status_idx on public.web_image_jobs(status,lease_until);
create table if not exists public.web_credit_operations (
  user_id uuid not null references public.web_users(id),
  reference_id text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  primary key(user_id,reference_id)
);
alter table public.web_image_jobs enable row level security;
alter table public.web_credit_operations enable row level security;

create or replace function public.web_job_reserve(p_id text,p_user_id uuid,p_request_id text,p_group_id text,p_payload jsonb,p_cost integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u web_users; j web_image_jobs;
begin
  select * into u from web_users where id=p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;
  select * into j from web_image_jobs where user_id=p_user_id and request_id=p_request_id;
  if found then return to_jsonb(j); end if;
  if p_cost < 0 or u.credits-u.reserved_credits < p_cost then raise exception 'insufficient_credits'; end if;
  insert into web_image_jobs(id,user_id,request_id,group_id,payload,cost)
  values(p_id,p_user_id,p_request_id,p_group_id,p_payload,p_cost) returning * into j;
  update web_users set reserved_credits=reserved_credits+p_cost where id=p_user_id;
  return to_jsonb(j);
end $$;

create or replace function public.web_job_claim(p_id text,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j web_image_jobs;
begin
  update web_image_jobs set status='processing',lease_until=now()+interval '20 minutes',updated_at=now()
  where id=p_id and user_id=p_user_id and status='queued' returning * into j;
  return case when found then to_jsonb(j) else null end;
end $$;

create or replace function public.web_job_finish(p_id text,p_user_id uuid,p_status text,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j web_image_jobs;
begin
  -- Always lock account before job so reserve/settle/payment share one lock order.
  perform 1 from web_users where id=p_user_id for update;
  select * into j from web_image_jobs where id=p_id and user_id=p_user_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if j.settled then return to_jsonb(j); end if;
  if p_status not in ('done','error') then raise exception 'invalid_terminal_status'; end if;
  if p_status='done' and coalesce(p_result->>'image_url','')='' then raise exception 'missing_stored_result'; end if;
  update web_users set reserved_credits=greatest(0,reserved_credits-j.cost),
    credits=credits-case when p_status='done' then j.cost else 0 end where id=p_user_id;
  if p_status='done' then
    insert into web_credit_operations(user_id,reference_id,amount) values(p_user_id,'job:'||p_id,-j.cost);
    insert into web_credit_transactions(user_id,amount,type,description,reference_id)
    values(p_user_id,-j.cost,'generation',coalesce(j.payload->'context'->>'label','图片生成'),'job:'||p_id);
  end if;
  update web_image_jobs set status=p_status,result=p_result,settled=true,lease_until=null,updated_at=now()
  where id=p_id returning * into j;
  return to_jsonb(j);
end $$;

create or replace function public.web_credit_apply(p_user_id uuid,p_reference_id text,p_amount integer,p_type text,p_description text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u web_users; inserted integer;
begin
  select * into u from web_users where id=p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;
  if coalesce(p_reference_id,'')='' then raise exception 'missing_reference'; end if;
  if exists(select 1 from web_credit_operations where user_id=p_user_id and reference_id=p_reference_id) then
    return jsonb_build_object('credits',u.credits,'duplicate',true);
  end if;
  if u.credits+p_amount-u.reserved_credits < 0 then raise exception 'insufficient_credits'; end if;
  insert into web_credit_operations(user_id,reference_id,amount) values(p_user_id,p_reference_id,p_amount);
  update web_users set credits=credits+p_amount where id=p_user_id returning * into u;
  insert into web_credit_transactions(user_id,amount,type,description,reference_id)
  values(p_user_id,p_amount,p_type,p_description,p_reference_id);
  return jsonb_build_object('credits',u.credits,'duplicate',false);
end $$;

-- RPCs must never be executable with anonymous or ordinary signed-in Supabase keys.
revoke all on function public.web_job_reserve(text,uuid,text,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.web_job_claim(text,uuid) from public,anon,authenticated;
revoke all on function public.web_job_finish(text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.web_credit_apply(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.web_job_reserve(text,uuid,text,text,jsonb,integer) to service_role;
grant execute on function public.web_job_claim(text,uuid) to service_role;
grant execute on function public.web_job_finish(text,uuid,text,jsonb) to service_role;
grant execute on function public.web_credit_apply(uuid,text,integer,text,text) to service_role;
grant all on public.web_image_jobs,public.web_credit_operations to service_role;

create or replace function public.web_job_history(p_user_id uuid,p_limit integer,p_offset integer)
returns setof public.web_image_jobs language sql security definer set search_path=public as $$
  select j.* from web_image_jobs j join (
    select group_id,max(created_at) as newest from web_image_jobs where user_id=p_user_id
    group by group_id order by newest desc limit least(5000,greatest(1,p_limit)) offset greatest(0,p_offset)
  ) g on g.group_id=j.group_id where j.user_id=p_user_id order by g.newest desc,j.created_at;
$$;
revoke all on function public.web_job_history(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.web_job_history(uuid,integer,integer) to service_role;
