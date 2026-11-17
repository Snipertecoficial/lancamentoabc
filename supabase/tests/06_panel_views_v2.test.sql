-- Radar / Plan 2 Task 5: panel_campaigns_daily + origin/referrer_host in panel_sessions_live (pgTAP).
-- Self-contained, leaves no data behind: everything happens inside a block that is rolled back.
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as $$
declare
  out text[] := '{}';
  admin_uid uuid := '00000000-0000-0000-0000-0000000006ad';
  plain_uid uuid := '00000000-0000-0000-0000-0000000006ae';
  s_late uuid := '00000000-0000-0000-0000-0000000006a1';  -- 23:30 in Sao Paulo, already the next day in UTC
  s_next uuid := '00000000-0000-0000-0000-0000000006a2';  -- 00:30 in Sao Paulo
  s_bot uuid := '00000000-0000-0000-0000-0000000006a3';
  s_lg uuid := '00000000-0000-0000-0000-0000000006a4';    -- live, gclid
  s_lo uuid := '00000000-0000-0000-0000-0000000006a5';    -- live, from Google search
  s_ld uuid := '00000000-0000-0000-0000-0000000006a6';    -- live, direct
  l1 uuid := '00000000-0000-0000-0000-0000000006c1';
  v text; n int; cols text[];
  vw text; anon_any boolean := false; auth_all boolean := true; inv_all boolean := true;
begin
  begin
    out := out || extensions.plan(12);

    insert into auth.users(id, aud, role, email) values
      (admin_uid, 'authenticated', 'authenticated', 'admin-t6@example.invalid'),
      (plain_uid, 'authenticated', 'authenticated', 'plain-t6@example.invalid');
    insert into public.profiles(user_id, role) values (admin_uid, 'admin');

    insert into public.sessions(id, env, started_at, last_event_at, landing_url, referrer, utm_source, utm_medium, utm_campaign, keyword, gclid, device, is_bot) values
      (s_late, 'staging', '2026-11-10 02:30:00+00', '2026-11-10 02:35:00+00', 'https://x.test/?gclid=6', null, 'google', 'cpc', 'camp-t6', 'kw-t6', 'g6', 'mobile', false),
      (s_next, 'staging', '2026-11-10 03:30:00+00', '2026-11-10 03:35:00+00', 'https://x.test/?gclid=7', null, 'google', 'cpc', 'camp-t6', 'kw-t6', 'g7', 'mobile', false),
      (s_bot,  'staging', '2026-11-10 03:40:00+00', '2026-11-10 03:41:00+00', 'https://x.test/?gclid=8', null, 'google', 'cpc', 'camp-t6', 'kw-t6', 'g8', 'desktop', true),
      (s_lg, 'staging', now() - interval '3 minute', now(), 'https://x.test/?gclid=9', null, 'google', 'cpc', 'camp-live-t6', null, 'g9', 'mobile', false),
      (s_lo, 'staging', now() - interval '2 minute', now(), 'https://x.test/', 'https://www.Google.com.br/search?q=apto', null, null, null, null, null, 'desktop', false),
      (s_ld, 'staging', now() - interval '1 minute', now(), 'https://x.test/', null, null, null, null, null, null, 'desktop', false);
    insert into public.leads(id, env, phone_e164, name, first_session_id, submitted_at) values
      (l1, 'staging', '+5511900000601', 'Lead Seis', s_late, '2026-11-10 02:34:00+00');

    -- admin
    perform set_config('request.jwt.claims', json_build_object('sub', admin_uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', admin_uid::text, true);
    set local role authenticated;

    select string_agg(day || ':' || visits || '/' || leads, ',' order by day) into v from public.panel_campaigns_daily
      where env = 'staging' and origin = 'google_ads' and utm_campaign = 'camp-t6' and keyword = 'kw-t6';
    out := out || extensions.is(v, '2026-11-09:1/1,2026-11-10:1/0', 'campaigns_daily: dia em Sao Paulo, visitas e leads por dia, sem bots');
    select count(*) into n from public.panel_campaigns_daily
      where env = 'staging' and utm_campaign = 'camp-t6' and day between '2026-11-10' and '2026-11-10';
    out := out || extensions.is(n, 1, 'campaigns_daily filtra por intervalo de dias');

    select origin || '/' || coalesce(referrer_host, '-') into v from public.panel_sessions_live where id = s_lg;
    out := out || extensions.is(v, 'google_ads/-', 'live: gclid -> google_ads');
    select origin || '/' || coalesce(referrer_host, '-') into v from public.panel_sessions_live where id = s_lo;
    out := out || extensions.is(v, 'organic_search/www.google.com.br', 'live: busca do Google -> organic_search, referrer_host');
    select origin || '/' || coalesce(referrer_host, '-') into v from public.panel_sessions_live where id = s_ld;
    out := out || extensions.is(v, 'direct/-', 'live: sem referrer nem utm -> direct');
    reset role;

    -- authenticated but not admin
    perform set_config('request.jwt.claims', json_build_object('sub', plain_uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', plain_uid::text, true);
    set local role authenticated;
    select count(*) into n from public.panel_campaigns_daily where utm_campaign = 'camp-t6';
    out := out || extensions.is(n, 0, 'nao admin ve 0 linhas em panel_campaigns_daily');
    select count(*) into n from public.panel_sessions_live where id in (s_lg, s_lo, s_ld);
    out := out || extensions.is(n, 0, 'nao admin ve 0 sessoes live');
    reset role;

    -- privileges and shape
    foreach vw in array array['panel_campaigns_daily', 'panel_sessions_live'] loop
      anon_any := anon_any or has_table_privilege('anon', 'public.' || vw, 'select');
      auth_all := auth_all and has_table_privilege('authenticated', 'public.' || vw, 'select');
      inv_all := inv_all and coalesce((select 'security_invoker=true' = any(c.reloptions) from pg_class c
        where c.oid = ('public.' || vw)::regclass), false);
    end loop;
    out := out || extensions.is(anon_any, false, 'anon sem select nas views v2');
    out := out || extensions.is(auth_all, true, 'authenticated tem select nas views v2');
    out := out || extensions.is(inv_all, true, 'views v2 sao security_invoker');
    select array_agg(column_name::text order by ordinal_position) into cols
      from information_schema.columns where table_schema = 'public' and table_name = 'panel_sessions_live';
    out := out || extensions.is(cols, array['id','env','started_at','last_event_at','landing_url','utm_source','utm_campaign','keyword','device','lead_id','current_section','origin','referrer_host'],
      'panel_sessions_live mantem as colunas e acrescenta origin, referrer_host no fim');
    select array_agg(column_name::text order by ordinal_position) into cols
      from information_schema.columns where table_schema = 'public' and table_name = 'panel_campaigns_daily';
    out := out || extensions.is(cols, array['day','env','origin','utm_campaign','keyword','visits','leads'], 'colunas de panel_campaigns_daily');

    out := out || array(select * from extensions.finish());
    raise exception 'ROLLBACK_TESTS';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_TESTS' then raise; end if;
  end;
  return query select unnest(out);
end $$;

select * from pg_temp.run_tests();
