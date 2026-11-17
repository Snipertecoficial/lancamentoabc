-- Radar plan 2: admin panel views. security_invoker => the RLS of the base tables (admin only) applies.

-- Traffic origin of a session; shared by the views below.
create function public.panel_origin(
  gclid text, gbraid text, wbraid text, fbclid text,
  utm_source text, utm_medium text, utm_campaign text, referrer text
) returns text
language sql immutable
set search_path = ''
as $$
  select case
    when coalesce(gclid,'') <> '' or coalesce(gbraid,'') <> '' or coalesce(wbraid,'') <> ''
      or (lower(coalesce(utm_medium,'')) in ('cpc','ppc','paid') and lower(coalesce(utm_source,'')) like 'google%')
      then 'google_ads'
    when coalesce(fbclid,'') <> ''
      or (lower(coalesce(utm_source,'')) in ('facebook','instagram','meta','fb','ig')
          and lower(coalesce(utm_medium,'')) in ('cpc','ppc','paid','paid_social','paidsocial'))
      then 'meta_ads'
    when coalesce(referrer,'') ~* '^https?://([^/]*\.)?(google|bing|yahoo|duckduckgo|ecosia|baidu|yandex|brave)\.'
      then 'organic_search'
    when coalesce(referrer,'') = '' and coalesce(utm_source,'') = '' and coalesce(utm_medium,'') = '' and coalesce(utm_campaign,'') = ''
      then 'direct'
    else 'other'
  end
$$;
revoke all on function public.panel_origin(text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.panel_origin(text,text,text,text,text,text,text,text) to authenticated, service_role;

create view public.panel_leads with (security_invoker = true) as
select
  b.id, b.env, b.name, b.phone_e164, b.email, b.created_at, b.submitted_at, b.rd_confirmed_at, b.thank_you_at, b.whatsapp_at,
  b.stage,
  b.utm_source, b.utm_medium, b.utm_campaign, b.utm_term, b.keyword, b.gclid, b.fbclid, b.device, b.landing_url, b.referrer,
  b.origin, b.visits, b.events_count, b.last_event_at, b.video_max_pct, b.faq_questions,
  case when b.score >= 4 then 'quente' when b.score >= 2 then 'morno' else 'frio' end as temperature
from (
  select
    l.id, l.env, l.name, l.phone_e164, l.email, l.created_at, l.submitted_at, l.rd_confirmed_at, l.thank_you_at, l.whatsapp_at,
    case
      when l.whatsapp_at is not null then 'foi_whatsapp'
      when l.thank_you_at is not null then 'chegou_obrigado'
      when l.rd_confirmed_at is not null then 'confirmado_rd'
      else 'tentou'
    end as stage,
    s.utm_source, s.utm_medium, s.utm_campaign, s.utm_term, s.keyword, s.gclid, s.fbclid, s.device, s.landing_url, s.referrer,
    o.origin,
    coalesce(ev.visits, 0)::int as visits,
    coalesce(ev.events_count, 0)::int as events_count,
    ev.last_event_at,
    ev.video_max_pct,
    coalesce(fq.questions, '{}'::text[]) as faq_questions,
    (case when coalesce(ev.video_max_pct, 0) >= 50 then 2 else 0 end)
      + (case when array_to_string(fq.questions, ' ') ~* 'valor|preço|preco|parcela|financ|entrada' then 2 else 0 end)
      + (case when coalesce(ev.visits, 0) >= 2 then 1 else 0 end)
      + (case when o.origin in ('google_ads','meta_ads') then 1 else 0 end)
      + (case when l.thank_you_at is not null or l.whatsapp_at is not null then 1 else 0 end) as score
  from public.leads l
  left join public.sessions s on s.id = l.first_session_id
  cross join lateral (select public.panel_origin(s.gclid, s.gbraid, s.wbraid, s.fbclid, s.utm_source, s.utm_medium, s.utm_campaign, s.referrer) as origin) o
  left join lateral (
    select count(distinct e.session_id) as visits,
           count(*) as events_count,
           max(e.occurred_at) as last_event_at,
           max(case when e.type = 'video' and e.props->>'pct' ~ '^[0-9]+(\.[0-9]+)?$' then (e.props->>'pct')::numeric end) as video_max_pct
    from public.events e where e.lead_id = l.id
  ) ev on true
  left join lateral (
    select array_agg(q.question order by q.first_at) as questions
    from (
      select e.props->>'question' as question, min(e.occurred_at) as first_at
      from public.events e
      where e.lead_id = l.id and e.type = 'faq_open' and coalesce(e.props->>'question', '') <> ''
      group by 1
    ) q
  ) fq on true
) b;

create view public.panel_lead_events with (security_invoker = true) as
select e.lead_id, e.occurred_at, e.session_id, s.started_at as session_started_at, s.device,
       e.type, e.name, e.section, e.props
from public.events e
join public.sessions s on s.id = e.session_id
where e.lead_id is not null;

create view public.panel_sessions_live with (security_invoker = true) as
select s.id, s.env, s.started_at, s.last_event_at, s.landing_url, s.utm_source, s.utm_campaign, s.keyword, s.device,
       v.lead_id, cs.section as current_section
from public.sessions s
left join public.visitors v on v.id = s.visitor_id
left join lateral (
  select e.section from public.events e
  where e.session_id = s.id and e.type = 'section_view'
  order by e.occurred_at desc limit 1
) cs on true
where s.last_event_at > now() - interval '5 minutes' and s.is_bot = false;

create view public.panel_funnel_daily with (security_invoker = true) as
select
  (timezone('America/Sao_Paulo', s.started_at))::date as day,
  s.env,
  public.panel_origin(s.gclid, s.gbraid, s.wbraid, s.fbclid, s.utm_source, s.utm_medium, s.utm_campaign, s.referrer) as origin,
  count(*)::int as visits,
  count(*) filter (where f.video)::int as watched_video,
  count(*) filter (where f.form_view)::int as reached_form,
  count(*) filter (where f.form_start)::int as started_form,
  count(*) filter (where f.submitted)::int as submitted,
  count(*) filter (where f.thank_you)::int as thank_you,
  count(*) filter (where f.whatsapp)::int as whatsapp
from public.sessions s
cross join lateral (
  select coalesce(bool_or(e.type = 'video'), false) as video,
         coalesce(bool_or(e.type = 'form_view'), false) as form_view,
         coalesce(bool_or(e.type = 'form_start'), false) as form_start,
         coalesce(bool_or(e.type = 'lead_submitted'), false) as submitted,
         coalesce(bool_or(e.type = 'thank_you_view'), false) as thank_you,
         coalesce(bool_or(e.type = 'whatsapp_click'), false) as whatsapp
  from public.events e
  where e.session_id = s.id
    and e.type in ('video','form_view','form_start','lead_submitted','thank_you_view','whatsapp_click')
) f
where s.is_bot = false
group by 1, 2, 3;

create view public.panel_campaigns with (security_invoker = true) as
select
  s.env,
  public.panel_origin(s.gclid, s.gbraid, s.wbraid, s.fbclid, s.utm_source, s.utm_medium, s.utm_campaign, s.referrer) as origin,
  s.utm_campaign,
  s.keyword,
  count(distinct s.id)::int as visits,
  count(l.id)::int as leads,
  round(100.0 * count(l.id) / nullif(count(distinct s.id), 0), 2) as conversion_pct
from public.sessions s
left join public.leads l on l.first_session_id = s.id
where s.is_bot = false
group by 1, 2, 3, 4;

do $$
declare v text;
begin
  foreach v in array array['panel_leads','panel_lead_events','panel_sessions_live','panel_funnel_daily','panel_campaigns']
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', v);
    execute format('grant select on table public.%I to authenticated', v);
    execute format('grant all on table public.%I to service_role', v);
  end loop;
end $$;
