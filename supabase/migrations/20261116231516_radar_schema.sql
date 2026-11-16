-- Radar: first-party tracking schema. All writes come from Edge Functions (service_role).

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  env text not null check (env in ('staging','production')),
  phone_e164 text,
  phone_raw text,
  name text,
  email text,
  first_session_id uuid,
  first_visitor_id uuid,
  first_touch jsonb,
  last_touch jsonb,
  submitted_at timestamptz,
  rd_confirmed_at timestamptz,
  thank_you_at timestamptz,
  whatsapp_at timestamptz,
  rd_lead_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_env_phone_uq on public.leads (env, phone_e164);
create unique index leads_env_email_uq on public.leads (env, lower(email)) where phone_e164 is null;

create table public.visitors (
  id uuid primary key,
  env text not null check (env in ('staging','production')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_touch jsonb,
  last_touch jsonb,
  lead_id uuid references public.leads (id)
);
create index visitors_lead_id_idx on public.visitors (lead_id);

create table public.sessions (
  id uuid primary key,
  visitor_id uuid references public.visitors (id),
  env text not null check (env in ('staging','production')),
  started_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  landing_url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  keyword text,
  matchtype text,
  campaign_id text,
  adgroup_id text,
  device text,
  screen text,
  lang text,
  user_agent text,
  ip_hash text,
  is_bot boolean not null default false
);
create index sessions_visitor_id_idx on public.sessions (visitor_id);
create index sessions_started_at_idx on public.sessions (started_at);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id),
  visitor_id uuid,
  lead_id uuid,
  type text not null check (type in (
    'page_view','scroll_depth','section_view','cta_click','whatsapp_click','rage_click',
    'video','faq_open','slider_view','form_view','form_start','form_field_complete',
    'form_abandon','form_submit_attempt','lead_submitted','thank_you_view','consent')),
  name text,
  section text,
  props jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index events_occurred_at_idx on public.events (occurred_at);
create index events_visitor_id_idx on public.events (visitor_id);
create index events_lead_id_idx on public.events (lead_id);
create index events_session_occurred_idx on public.events (session_id, occurred_at);
create index events_type_idx on public.events (type);

create table public.lead_visitors (
  lead_id uuid not null references public.leads (id),
  visitor_id uuid not null references public.visitors (id),
  primary key (lead_id, visitor_id)
);
create index lead_visitors_visitor_id_idx on public.lead_visitors (visitor_id);

create table public.lead_tokens (
  token uuid primary key,
  lead_id uuid not null references public.leads (id),
  session_id uuid,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index lead_tokens_lead_id_idx on public.lead_tokens (lead_id);

create table public.rd_webhook_raw (
  id bigserial primary key,
  received_at timestamptz not null default now(),
  payload jsonb,
  matched_lead_ids uuid[],
  error text
);

create table public.profiles (
  user_id uuid primary key references auth.users (id),
  role text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- RLS: only admins read; no write policies; nothing for anon.
do $$
declare t text;
begin
  foreach t in array array['visitors','sessions','events','leads','lead_visitors','lead_tokens','rd_webhook_raw','profiles']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_admin()))', t || '_admin_select', t);
  end loop;
end $$;
revoke all on sequence public.rd_webhook_raw_id_seq from anon, authenticated;
grant all on sequence public.rd_webhook_raw_id_seq to service_role;
