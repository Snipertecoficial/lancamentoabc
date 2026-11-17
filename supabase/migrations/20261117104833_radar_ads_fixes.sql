-- Radar / Google Ads review fixes:
-- 1) Only Google traffic is attributed to Google campaigns: the fallbacks (campaign_id in the URL,
--    utm_campaign) need a Google signal (gclid/gbraid/wbraid or utm_source google*) and no fbclid,
--    and the campaign must exist in ads_campaign_daily. Campaign lookups go through a small
--    distinct list instead of scanning the daily table per lead.
-- 2) Leads with no keyword match are grouped by the keyword the URL carried, not merged.
-- 3) Overlapping ads_ingest runs for the same account wait for each other.

create or replace view public.panel_ads_lead_attribution with (security_invoker = true) as
with camps as (
  select distinct campaign_id, lower(campaign_name) as name_l from public.ads_campaign_daily
)
select
  x.lead_id, x.env, x.day, x.campaign_id,
  coalesce(x.click_ad_group_id, x.session_ad_group_id) as ad_group_id,
  coalesce(x.click_criterion_id, k.criterion_id) as criterion_id,
  coalesce(x.click_keyword_text, k.keyword_text, x.session_keyword) as keyword_text,
  coalesce(x.click_match_type, k.match_type) as match_type,
  x.method
from (
  select
    l.id as lead_id, l.env,
    (timezone('America/Sao_Paulo', coalesce(l.submitted_at, l.created_at)))::date as day,
    coalesce(c.campaign_id, sc.campaign_id, nc.campaign_id) as campaign_id,
    case when c.gclid is not null then 'gclid'
         when sc.campaign_id is not null then 'campaign_id'
         else 'utm_campaign' end as method,
    c.gclid is not null as by_click,
    c.ad_group_id as click_ad_group_id, c.criterion_id as click_criterion_id,
    c.keyword_text as click_keyword_text, c.match_type as click_match_type,
    nullif(s.adgroup_id, '') as session_ad_group_id, nullif(s.keyword, '') as session_keyword
  from public.leads l
  join public.sessions s on s.id = l.first_session_id
  left join public.ads_clicks c on c.gclid = s.gclid
  cross join lateral (
    select (coalesce(s.gclid, '') <> '' or coalesce(s.gbraid, '') <> '' or coalesce(s.wbraid, '') <> ''
            or lower(coalesce(s.utm_source, '')) like 'google%')
           and coalesce(s.fbclid, '') = '' as google
  ) g
  left join lateral (
    select ca.campaign_id from camps ca
    where c.gclid is null and g.google and ca.campaign_id = nullif(s.campaign_id, '')
    limit 1
  ) sc on true
  left join lateral (
    select ca.campaign_id from camps ca
    where c.gclid is null and sc.campaign_id is null and g.google and nullif(s.utm_campaign, '') is not null
      and (ca.campaign_id = s.utm_campaign or ca.name_l = lower(s.utm_campaign))
    order by ca.campaign_id
    limit 1
  ) nc on true
) x
left join lateral (
  select kw.criterion_id, kw.keyword_text, kw.match_type from public.ads_keyword_daily kw
  where not x.by_click and x.session_ad_group_id is not null and x.session_keyword is not null
    and kw.ad_group_id = x.session_ad_group_id and lower(kw.keyword_text) = lower(x.session_keyword)
  order by kw.day desc limit 1
) k on true
where x.campaign_id is not null;

create or replace view public.panel_ads_keywords_daily with (security_invoker = true) as
with stats as (
  select day, campaign_id, ad_group_id, criterion_id, sum(impressions) as impressions, sum(clicks) as clicks,
         sum(cost_micros) as cost_micros, sum(conversions) as conversions
  from public.ads_keyword_daily group by day, campaign_id, ad_group_id, criterion_id
), lead_counts as (
  select day, campaign_id, ad_group_id, criterion_id,
         case when criterion_id is null then keyword_text end as unmatched_keyword,
         max(keyword_text) as keyword_text, count(*) as leads
  from public.panel_ads_lead_attribution where env = 'production'
  group by day, campaign_id, ad_group_id, criterion_id, case when criterion_id is null then keyword_text end
), kw_names as (
  select distinct on (ad_group_id, criterion_id) ad_group_id, criterion_id, keyword_text, match_type, ad_group_name
  from public.ads_keyword_daily order by ad_group_id, criterion_id, day desc
), camp_names as (
  select distinct on (campaign_id) campaign_id, campaign_name
  from public.ads_campaign_daily order by campaign_id, day desc
)
select
  coalesce(s.day, lc.day) as day,
  coalesce(s.campaign_id, lc.campaign_id) as campaign_id,
  cn.campaign_name,
  coalesce(s.ad_group_id, lc.ad_group_id) as ad_group_id,
  kn.ad_group_name,
  coalesce(s.criterion_id, lc.criterion_id) as criterion_id,
  coalesce(kn.keyword_text, lc.keyword_text) as keyword_text,
  kn.match_type,
  coalesce(s.impressions, 0)::bigint as impressions,
  coalesce(s.clicks, 0)::bigint as clicks,
  coalesce(s.cost_micros, 0)::numeric / 1000000 as cost,
  coalesce(s.conversions, 0)::numeric as google_conversions,
  coalesce(lc.leads, 0)::int as leads
from stats s
full join lead_counts lc
  on lc.day = s.day and lc.campaign_id = s.campaign_id and lc.ad_group_id = s.ad_group_id and lc.criterion_id = s.criterion_id
left join kw_names kn on kn.ad_group_id = coalesce(s.ad_group_id, lc.ad_group_id) and kn.criterion_id = coalesce(s.criterion_id, lc.criterion_id)
left join camp_names cn on cn.campaign_id = coalesce(s.campaign_id, lc.campaign_id);

create or replace function public.ads_ingest(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  cust text := p->>'customer_id';
  d_from date; d_to date;
  n_c int := 0; n_k int := 0; n_cl int := 0;
begin
  if cust is null or cust !~ '^[0-9]{6,12}$' then
    raise exception 'ads_ingest: invalid customer_id' using errcode = '22023';
  end if;
  -- One run per account at a time (delete-then-insert of the same range would collide).
  perform pg_advisory_xact_lock(hashtext('radar_ads_ingest:' || cust));

  if jsonb_typeof(p->'stats') = 'object' then
    d_from := (p->'stats'->>'date_from')::date;
    d_to := (p->'stats'->>'date_to')::date;
    if d_from is null or d_to is null or d_from > d_to or d_to - d_from > 400 then
      raise exception 'ads_ingest: invalid stats range' using errcode = '22023';
    end if;

    delete from public.ads_campaign_daily where customer_id = cust and day between d_from and d_to;
    insert into public.ads_campaign_daily (customer_id, day, campaign_id, campaign_name, channel, impressions, clicks, cost_micros, conversions)
    select cust, r.day, r.campaign_id, max(r.campaign_name), max(r.channel),
           sum(coalesce(r.impressions, 0)), sum(coalesce(r.clicks, 0)), sum(coalesce(r.cost_micros, 0)), sum(coalesce(r.conversions, 0))
    from jsonb_to_recordset(coalesce(p->'stats'->'campaigns', '[]'::jsonb))
      as r(day date, campaign_id text, campaign_name text, channel text, impressions bigint, clicks bigint, cost_micros bigint, conversions numeric)
    where r.day between d_from and d_to and r.campaign_id is not null
    group by r.day, r.campaign_id;
    get diagnostics n_c = row_count;

    delete from public.ads_keyword_daily where customer_id = cust and day between d_from and d_to;
    insert into public.ads_keyword_daily (customer_id, day, campaign_id, ad_group_id, criterion_id, ad_group_name, keyword_text, match_type,
                                          impressions, clicks, cost_micros, conversions)
    select cust, r.day, max(r.campaign_id), r.ad_group_id, r.criterion_id, max(r.ad_group_name), max(r.keyword_text), max(r.match_type),
           sum(coalesce(r.impressions, 0)), sum(coalesce(r.clicks, 0)), sum(coalesce(r.cost_micros, 0)), sum(coalesce(r.conversions, 0))
    from jsonb_to_recordset(coalesce(p->'stats'->'keywords', '[]'::jsonb))
      as r(day date, campaign_id text, ad_group_id text, criterion_id text, ad_group_name text, keyword_text text, match_type text,
           impressions bigint, clicks bigint, cost_micros bigint, conversions numeric)
    where r.day between d_from and d_to and r.campaign_id is not null and r.ad_group_id is not null and r.criterion_id is not null
    group by r.day, r.ad_group_id, r.criterion_id;
    get diagnostics n_k = row_count;
  end if;

  insert into public.ads_clicks (customer_id, gclid, day, campaign_id, ad_group_id, criterion_id, keyword_text, match_type)
  select distinct on (r.gclid) cust, r.gclid, r.day, r.campaign_id, r.ad_group_id, r.criterion_id, r.keyword_text, r.match_type
  from jsonb_to_recordset(case when jsonb_typeof(p->'clicks') = 'array' then p->'clicks' else '[]'::jsonb end)
    as r(gclid text, day date, campaign_id text, ad_group_id text, criterion_id text, keyword_text text, match_type text)
  where coalesce(r.gclid, '') <> '' and r.day is not null
  order by r.gclid
  on conflict (gclid) do update set
    customer_id = excluded.customer_id, day = excluded.day, campaign_id = excluded.campaign_id,
    ad_group_id = excluded.ad_group_id, criterion_id = excluded.criterion_id,
    keyword_text = excluded.keyword_text, match_type = excluded.match_type, synced_at = now();
  get diagnostics n_cl = row_count;

  insert into public.ads_sync_runs (customer_id, currency, time_zone, date_from, date_to, campaigns, keywords, clicks)
  values (cust, left(p->>'currency', 8), left(p->>'time_zone', 64), d_from, d_to, n_c, n_k, n_cl);

  return jsonb_build_object('campaigns', n_c, 'keywords', n_k, 'clicks', n_cl);
end;
$$;
revoke all on function public.ads_ingest(jsonb) from public, anon, authenticated;
grant execute on function public.ads_ingest(jsonb) to service_role;
