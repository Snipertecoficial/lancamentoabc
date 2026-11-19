-- Radar / Google Ads: see and edit campaigns from the panel (spec 2026-11-19-radar-ads-edicao-design.md).
-- The Google Ads script sends the current state (campaigns, keywords) and 30-day insights (search terms,
-- cost per network), pulls pending edits from ads_commands, applies them and reports back.
-- Everything goes through the ads-sync Edge Function (service_role); the panel reads with admin-only RLS
-- and may only insert pending commands or cancel its pending ones.

create table public.ads_campaigns (
  customer_id text not null,
  campaign_id text not null,
  campaign_name text,
  status text,
  channel text,
  bidding_strategy text,
  budget_id text,
  budget_micros bigint,
  budget_shared boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (customer_id, campaign_id)
);

create table public.ads_keywords (
  customer_id text not null,
  ad_group_id text not null,
  criterion_id text not null,
  campaign_id text not null,
  ad_group_name text,
  keyword_text text,
  match_type text,
  status text,
  synced_at timestamptz not null default now(),
  primary key (customer_id, ad_group_id, criterion_id)
);
create index ads_keywords_campaign_idx on public.ads_keywords (campaign_id);

-- Last 30 days, aggregated (one row per term per ad group). Replaced on every sync.
create table public.ads_search_terms (
  customer_id text not null,
  date_from date not null,
  date_to date not null,
  campaign_id text not null,
  ad_group_id text not null,
  search_term text not null,
  status text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost_micros bigint not null default 0,
  conversions numeric not null default 0,
  synced_at timestamptz not null default now(),
  primary key (customer_id, campaign_id, ad_group_id, search_term)
);

-- Last 30 days per campaign and network (SEARCH, YOUTUBE, CONTENT, MIXED...). Replaced on every sync.
create table public.ads_network_stats (
  customer_id text not null,
  date_from date not null,
  date_to date not null,
  campaign_id text not null,
  network text not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost_micros bigint not null default 0,
  conversions numeric not null default 0,
  synced_at timestamptz not null default now(),
  primary key (customer_id, campaign_id, network)
);

create table public.ads_commands (
  id bigserial primary key,
  customer_id text,
  kind text not null check (kind in ('campaign_status', 'campaign_budget', 'keyword_status', 'campaign_negative')),
  campaign_id text not null check (campaign_id ~ '^[0-9]{1,20}$'),
  ad_group_id text check (ad_group_id ~ '^[0-9]{1,20}$'),
  criterion_id text check (criterion_id ~ '^[0-9]{1,20}$'),
  value jsonb not null,
  previous jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'applied', 'failed', 'expired', 'canceled')),
  error text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  done_at timestamptz,
  constraint ads_commands_value_valid check (
    case kind
      when 'campaign_status' then value->>'status' in ('ENABLED', 'PAUSED') and ad_group_id is null and criterion_id is null
      when 'keyword_status' then value->>'status' in ('ENABLED', 'PAUSED') and ad_group_id is not null and criterion_id is not null
      -- R$ 1 to R$ 10.000 per day, in whole cents (Google rejects fractions of a cent).
      when 'campaign_budget' then
        case when jsonb_typeof(value->'amount_micros') = 'number'
          then (value->>'amount_micros')::numeric between 1000000 and 10000000000
               and (value->>'amount_micros')::numeric % 10000 = 0
          else false end
      when 'campaign_negative' then
        jsonb_typeof(value->'text') = 'string' and length(btrim(value->>'text')) between 1 and 80
        and value->>'match_type' in ('EXACT', 'PHRASE', 'BROAD')
      else false
    end
  )
);
create index ads_commands_open_idx on public.ads_commands (id) where status in ('pending', 'sent');

do $$
declare t text;
begin
  foreach t in array array['ads_campaigns','ads_keywords','ads_search_terms','ads_network_stats','ads_commands']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_admin()))', t || '_admin_select', t);
  end loop;
end $$;

-- Panel: an admin creates pending commands (status/created_by come from the defaults) and may cancel
-- a command while it is still pending.
grant insert (kind, campaign_id, ad_group_id, criterion_id, value, previous) on public.ads_commands to authenticated;
grant update (status) on public.ads_commands to authenticated;
grant usage on sequence public.ads_commands_id_seq to authenticated;
grant all on sequence public.ads_commands_id_seq to service_role;
create policy ads_commands_admin_insert on public.ads_commands for insert to authenticated
  with check ((select public.is_admin()) and status = 'pending' and created_by = (select auth.uid()));
create policy ads_commands_admin_cancel on public.ads_commands for update to authenticated
  using ((select public.is_admin()) and status = 'pending')
  with check (status = 'canceled');

-- p: {customer_id, state?: {campaigns: [...], keywords: [...]},
--     insights?: {date_from, date_to, search_terms: [...], networks: [...]}}
-- Each part present replaces that account's snapshot.
create function public.ads_state_ingest(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  cust text := p->>'customer_id';
  d_from date; d_to date;
  n_c int := 0; n_k int := 0; n_t int := 0; n_n int := 0;
begin
  if cust is null or cust !~ '^[0-9]{6,12}$' then
    raise exception 'ads_state_ingest: invalid customer_id' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('radar_ads_state:' || cust));

  if jsonb_typeof(p->'state') = 'object' then
    if jsonb_typeof(p->'state'->'campaigns') = 'array' then
      delete from public.ads_campaigns where customer_id = cust;
      insert into public.ads_campaigns (customer_id, campaign_id, campaign_name, status, channel, bidding_strategy, budget_id, budget_micros, budget_shared)
      select distinct on (r.campaign_id) cust, r.campaign_id, r.campaign_name, r.status, r.channel, r.bidding_strategy, r.budget_id, r.budget_micros, coalesce(r.budget_shared, false)
      from jsonb_to_recordset(p->'state'->'campaigns')
        as r(campaign_id text, campaign_name text, status text, channel text, bidding_strategy text, budget_id text, budget_micros bigint, budget_shared boolean)
      where r.campaign_id is not null
      order by r.campaign_id;
      get diagnostics n_c = row_count;
    end if;
    if jsonb_typeof(p->'state'->'keywords') = 'array' then
      delete from public.ads_keywords where customer_id = cust;
      insert into public.ads_keywords (customer_id, ad_group_id, criterion_id, campaign_id, ad_group_name, keyword_text, match_type, status)
      select distinct on (r.ad_group_id, r.criterion_id) cust, r.ad_group_id, r.criterion_id, r.campaign_id, r.ad_group_name, r.keyword_text, r.match_type, r.status
      from jsonb_to_recordset(p->'state'->'keywords')
        as r(ad_group_id text, criterion_id text, campaign_id text, ad_group_name text, keyword_text text, match_type text, status text)
      where r.ad_group_id is not null and r.criterion_id is not null and r.campaign_id is not null
      order by r.ad_group_id, r.criterion_id;
      get diagnostics n_k = row_count;
    end if;
  end if;

  if jsonb_typeof(p->'insights') = 'object' then
    d_from := (p->'insights'->>'date_from')::date;
    d_to := (p->'insights'->>'date_to')::date;
    if d_from is null or d_to is null or d_from > d_to or d_to - d_from > 400 then
      raise exception 'ads_state_ingest: invalid insights range' using errcode = '22023';
    end if;
    if jsonb_typeof(p->'insights'->'search_terms') = 'array' then
      delete from public.ads_search_terms where customer_id = cust;
      insert into public.ads_search_terms (customer_id, date_from, date_to, campaign_id, ad_group_id, search_term, status, impressions, clicks, cost_micros, conversions)
      select cust, d_from, d_to, r.campaign_id, r.ad_group_id, r.search_term, max(r.status),
             sum(coalesce(r.impressions, 0)), sum(coalesce(r.clicks, 0)), sum(coalesce(r.cost_micros, 0)), sum(coalesce(r.conversions, 0))
      from jsonb_to_recordset(p->'insights'->'search_terms')
        as r(campaign_id text, ad_group_id text, search_term text, status text, impressions bigint, clicks bigint, cost_micros bigint, conversions numeric)
      where r.campaign_id is not null and r.ad_group_id is not null and coalesce(r.search_term, '') <> ''
      group by r.campaign_id, r.ad_group_id, r.search_term;
      get diagnostics n_t = row_count;
    end if;
    if jsonb_typeof(p->'insights'->'networks') = 'array' then
      delete from public.ads_network_stats where customer_id = cust;
      insert into public.ads_network_stats (customer_id, date_from, date_to, campaign_id, network, impressions, clicks, cost_micros, conversions)
      select cust, d_from, d_to, r.campaign_id, r.network,
             sum(coalesce(r.impressions, 0)), sum(coalesce(r.clicks, 0)), sum(coalesce(r.cost_micros, 0)), sum(coalesce(r.conversions, 0))
      from jsonb_to_recordset(p->'insights'->'networks')
        as r(campaign_id text, network text, impressions bigint, clicks bigint, cost_micros bigint, conversions numeric)
      where r.campaign_id is not null and coalesce(r.network, '') <> ''
      group by r.campaign_id, r.network;
      get diagnostics n_n = row_count;
    end if;
  end if;

  return jsonb_build_object('state_campaigns', n_c, 'state_keywords', n_k, 'search_terms', n_t, 'networks', n_n);
end;
$$;

-- Hands the script up to 50 commands to apply. Commands older than 24 h expire; a command sent more than
-- 10 min ago without a result is handed out again (every edit is idempotent or fails harmlessly).
create function public.ads_commands_claim(cust text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare out jsonb;
begin
  if cust is null or cust !~ '^[0-9]{6,12}$' then
    raise exception 'ads_commands_claim: invalid customer_id' using errcode = '22023';
  end if;
  update public.ads_commands set status = 'expired', done_at = now(), error = 'Não foi aplicado em 24 horas.'
  where status in ('pending', 'sent') and created_at < now() - interval '24 hours';

  with c as (
    select id from public.ads_commands
    where (customer_id is null or customer_id = cust)
      and (status = 'pending' or (status = 'sent' and sent_at < now() - interval '10 minutes'))
    order by id
    limit 50
    for update skip locked
  ), u as (
    update public.ads_commands a set status = 'sent', sent_at = now(), customer_id = cust
    from c where a.id = c.id
    returning a.id, a.kind, a.campaign_id, a.ad_group_id, a.criterion_id, a.value
  )
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) into out from u;
  return out;
end;
$$;

-- results: [{id, ok, error?}] for commands this account was handed.
create function public.ads_commands_report(cust text, results jsonb) returns int
language plpgsql security definer set search_path = ''
as $$
declare n int := 0;
begin
  if cust is null or cust !~ '^[0-9]{6,12}$' then
    raise exception 'ads_commands_report: invalid customer_id' using errcode = '22023';
  end if;
  update public.ads_commands a set
    status = case when r.ok then 'applied' else 'failed' end,
    error = case when r.ok then null else left(coalesce(nullif(btrim(r.error), ''), 'O Google Ads recusou a alteração.'), 500) end,
    done_at = now()
  from jsonb_to_recordset(case when jsonb_typeof(results) = 'array' then results else '[]'::jsonb end)
    as r(id bigint, ok boolean, error text)
  where a.id = r.id and a.status = 'sent' and a.customer_id = cust and r.ok is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.ads_state_ingest(jsonb) from public, anon, authenticated;
revoke all on function public.ads_commands_claim(text) from public, anon, authenticated;
revoke all on function public.ads_commands_report(text, jsonb) from public, anon, authenticated;
grant execute on function public.ads_state_ingest(jsonb) to service_role;
grant execute on function public.ads_commands_claim(text) to service_role;
grant execute on function public.ads_commands_report(text, jsonb) to service_role;
