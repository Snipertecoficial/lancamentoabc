-- Radar plan 2 / Task 5: campaigns per day, and the traffic origin of live sessions.
-- security_invoker => the RLS of the base tables (admin only) applies.

-- Same as panel_campaigns, bucketed by the Sao Paulo day the session started, so the panel can
-- filter campaigns by period (panel_campaigns stays as is: whole history).
create view public.panel_campaigns_daily with (security_invoker = true) as
select
  (timezone('America/Sao_Paulo', s.started_at))::date as day,
  s.env,
  public.panel_origin(s.gclid, s.gbraid, s.wbraid, s.fbclid, s.utm_source, s.utm_medium, s.utm_campaign, s.referrer) as origin,
  s.utm_campaign,
  s.keyword,
  count(distinct s.id)::int as visits,
  count(l.id)::int as leads
from public.sessions s
left join public.leads l on l.first_session_id = s.id
where s.is_bot = false
group by 1, 2, 3, 4, 5;

-- Live sessions gain origin and the referrer's host; existing columns keep their order.
create or replace view public.panel_sessions_live with (security_invoker = true) as
select s.id, s.env, s.started_at, s.last_event_at, s.landing_url, s.utm_source, s.utm_campaign, s.keyword, s.device,
       v.lead_id, cs.section as current_section,
       public.panel_origin(s.gclid, s.gbraid, s.wbraid, s.fbclid, s.utm_source, s.utm_medium, s.utm_campaign, s.referrer) as origin,
       nullif(substring(lower(s.referrer) from '^[a-z][a-z0-9+.-]*://(?:[^/?#@]*@)?([^/?#:]+)'), '') as referrer_host
from public.sessions s
left join public.visitors v on v.id = s.visitor_id
left join lateral (
  select e.section from public.events e
  where e.session_id = s.id and e.type = 'section_view'
  order by e.occurred_at desc limit 1
) cs on true
where s.last_event_at > now() - interval '5 minutes' and s.is_bot = false;

do $$
declare v text;
begin
  foreach v in array array['panel_campaigns_daily','panel_sessions_live']
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', v);
    execute format('grant select on table public.%I to authenticated', v);
    execute format('grant all on table public.%I to service_role', v);
  end loop;
end $$;
