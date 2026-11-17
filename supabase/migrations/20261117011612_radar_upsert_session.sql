-- upsert_session: cria a sessão ou preenche apenas colunas de meta NULL (nunca sobrescreve valores).
-- last_event_at sempre avança; started_at/ip_hash/is_bot ficam como na primeira inserção.
create or replace function public.upsert_session(p jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.sessions (
    id, visitor_id, env, started_at, last_event_at,
    landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    gclid, gbraid, wbraid, fbclid, keyword, matchtype, campaign_id, adgroup_id,
    device, screen, lang, user_agent, ip_hash, is_bot
  ) values (
    (p->>'id')::uuid, (p->>'visitor_id')::uuid, p->>'env',
    coalesce((p->>'started_at')::timestamptz, now()), now(),
    p->>'landing_url', p->>'referrer', p->>'utm_source', p->>'utm_medium', p->>'utm_campaign',
    p->>'utm_term', p->>'utm_content',
    p->>'gclid', p->>'gbraid', p->>'wbraid', p->>'fbclid', p->>'keyword', p->>'matchtype',
    p->>'campaign_id', p->>'adgroup_id',
    p->>'device', p->>'screen', p->>'lang', p->>'user_agent', p->>'ip_hash',
    coalesce((p->>'is_bot')::boolean, false)
  )
  on conflict (id) do update set
    last_event_at = now(),
    visitor_id  = coalesce(public.sessions.visitor_id,  excluded.visitor_id),
    landing_url = coalesce(public.sessions.landing_url, excluded.landing_url),
    referrer    = coalesce(public.sessions.referrer,    excluded.referrer),
    utm_source  = coalesce(public.sessions.utm_source,  excluded.utm_source),
    utm_medium  = coalesce(public.sessions.utm_medium,  excluded.utm_medium),
    utm_campaign = coalesce(public.sessions.utm_campaign, excluded.utm_campaign),
    utm_term    = coalesce(public.sessions.utm_term,    excluded.utm_term),
    utm_content = coalesce(public.sessions.utm_content, excluded.utm_content),
    gclid       = coalesce(public.sessions.gclid,       excluded.gclid),
    gbraid      = coalesce(public.sessions.gbraid,      excluded.gbraid),
    wbraid      = coalesce(public.sessions.wbraid,      excluded.wbraid),
    fbclid      = coalesce(public.sessions.fbclid,      excluded.fbclid),
    keyword     = coalesce(public.sessions.keyword,     excluded.keyword),
    matchtype   = coalesce(public.sessions.matchtype,   excluded.matchtype),
    campaign_id = coalesce(public.sessions.campaign_id, excluded.campaign_id),
    adgroup_id  = coalesce(public.sessions.adgroup_id,  excluded.adgroup_id),
    device      = coalesce(public.sessions.device,      excluded.device),
    screen      = coalesce(public.sessions.screen,      excluded.screen),
    lang        = coalesce(public.sessions.lang,        excluded.lang),
    user_agent  = coalesce(public.sessions.user_agent,  excluded.user_agent);
$$;

revoke execute on function public.upsert_session(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_session(jsonb) to service_role;
