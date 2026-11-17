-- Radar / Google Ads cost: ads_ingest + attribution + panel_ads_* views (pgTAP).
-- Self-contained, leaves no data behind: everything happens inside a block that is rolled back.
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as $$
declare
  out text[] := '{}';
  admin_uid uuid := '00000000-0000-0000-0000-0000000007ad';
  plain_uid uuid := '00000000-0000-0000-0000-0000000007ae';
  s_g uuid := '00000000-0000-0000-0000-0000000007a1';   -- gclid known in ads_clicks
  s_c uuid := '00000000-0000-0000-0000-0000000007a2';   -- campaign_id in the URL + adgroup/keyword
  s_u uuid := '00000000-0000-0000-0000-0000000007a3';   -- utm_campaign = campaign name (other case)
  s_n uuid := '00000000-0000-0000-0000-0000000007a4';   -- nothing to match
  s_st uuid := '00000000-0000-0000-0000-0000000007a5';  -- gclid, but staging
  l_g uuid := '00000000-0000-0000-0000-0000000007c1';
  l_c uuid := '00000000-0000-0000-0000-0000000007c2';
  l_u uuid := '00000000-0000-0000-0000-0000000007c3';
  l_n uuid := '00000000-0000-0000-0000-0000000007c4';
  l_st uuid := '00000000-0000-0000-0000-0000000007c5';
  s_meta uuid := '00000000-0000-0000-0000-0000000007a6';  -- Meta ad that also carries campaign_id=111
  s_fb uuid := '00000000-0000-0000-0000-0000000007a7';    -- facebook utm_campaign with a Google campaign name
  s_unk uuid := '00000000-0000-0000-0000-0000000007a8';   -- Google, campaign_id not in ads_campaign_daily
  s_kw2 uuid := '00000000-0000-0000-0000-0000000007a9';   -- Google, campaign_id + a keyword with no stats
  l_meta uuid := '00000000-0000-0000-0000-0000000007c6';
  l_fb uuid := '00000000-0000-0000-0000-0000000007c7';
  l_unk uuid := '00000000-0000-0000-0000-0000000007c8';
  l_kw2 uuid := '00000000-0000-0000-0000-0000000007c9';
  res jsonb; v text; n int; st text;
  vw text; anon_any boolean := false; inv_all boolean := true;
begin
  begin
    out := out || extensions.plan(23);

    -- 1st sync: 2 days of stats + clicks (one gclid twice in the payload)
    res := public.ads_ingest(jsonb_build_object(
      'customer_id', '1234567890', 'currency', 'BRL', 'time_zone', 'America/Sao_Paulo',
      'stats', jsonb_build_object('date_from', '2026-11-09', 'date_to', '2026-11-10',
        'campaigns', jsonb_build_array(
          jsonb_build_object('day', '2026-11-09', 'campaign_id', '111', 'campaign_name', 'SBC Pesquisa', 'channel', 'SEARCH', 'impressions', 1000, 'clicks', 50, 'cost_micros', 99000000, 'conversions', 2),
          jsonb_build_object('day', '2026-11-10', 'campaign_id', '111', 'campaign_name', 'SBC Pesquisa', 'channel', 'SEARCH', 'impressions', 800, 'clicks', 40, 'cost_micros', 80500000, 'conversions', 1),
          jsonb_build_object('day', '2026-11-10', 'campaign_id', '222', 'campaign_name', 'PMax Espontone', 'channel', 'PERFORMANCE_MAX', 'impressions', 500, 'clicks', 10, 'cost_micros', 20000000, 'conversions', 0)),
        'keywords', jsonb_build_array(
          jsonb_build_object('day', '2026-11-10', 'campaign_id', '111', 'ad_group_id', '901', 'criterion_id', '7001', 'ad_group_name', 'Apartamentos', 'keyword_text', 'apartamento sbc', 'match_type', 'PHRASE', 'impressions', 600, 'clicks', 30, 'cost_micros', 60000000, 'conversions', 1),
          jsonb_build_object('day', '2026-11-10', 'campaign_id', '111', 'ad_group_id', '901', 'criterion_id', '7002', 'ad_group_name', 'Apartamentos', 'keyword_text', 'lancamento sbc', 'match_type', 'EXACT', 'impressions', 200, 'clicks', 10, 'cost_micros', 20500000, 'conversions', 0))),
      'clicks', jsonb_build_array(
        jsonb_build_object('gclid', 'G-T7-1', 'day', '2026-11-10', 'campaign_id', '111', 'ad_group_id', '901', 'criterion_id', '7001', 'keyword_text', 'apartamento sbc', 'match_type', 'PHRASE'),
        jsonb_build_object('gclid', 'G-T7-1', 'day', '2026-11-10', 'campaign_id', '111', 'ad_group_id', '901', 'criterion_id', '7001', 'keyword_text', 'apartamento sbc', 'match_type', 'PHRASE'),
        jsonb_build_object('gclid', 'G-T7-ST', 'day', '2026-11-10', 'campaign_id', '111', 'ad_group_id', '901', 'criterion_id', '7001', 'keyword_text', 'apartamento sbc', 'match_type', 'PHRASE'))));
    out := out || extensions.is(res, '{"campaigns": 3, "keywords": 2, "clicks": 2}'::jsonb, 'ads_ingest conta linhas; gclid repetido entra uma vez');
    select count(*) into n from public.ads_sync_runs where customer_id = '1234567890' and date_to = '2026-11-10' and currency = 'BRL';
    out := out || extensions.is(n, 1, 'ads_ingest registra a sincronizacao');

    -- 2nd sync only for 11-10, campaign 222 gone: range replaced, 11-09 kept
    res := public.ads_ingest(jsonb_build_object('customer_id', '1234567890',
      'stats', jsonb_build_object('date_from', '2026-11-10', 'date_to', '2026-11-10',
        'campaigns', jsonb_build_array(
          jsonb_build_object('day', '2026-11-10', 'campaign_id', '111', 'campaign_name', 'SBC Pesquisa', 'channel', 'SEARCH', 'impressions', 800, 'clicks', 40, 'cost_micros', 80500000, 'conversions', 1),
          jsonb_build_object('day', '2026-11-11', 'campaign_id', '111', 'campaign_name', 'fora do intervalo', 'impressions', 1, 'clicks', 1, 'cost_micros', 1, 'conversions', 0)),
        'keywords', (select jsonb_agg(to_jsonb(k) - 'customer_id' - 'synced_at') from public.ads_keyword_daily k where k.customer_id = '1234567890'))));
    select string_agg(day || '/' || campaign_id, ',' order by day, campaign_id) into v from public.ads_campaign_daily where customer_id = '1234567890';
    out := out || extensions.is(v, '2026-11-09/111,2026-11-10/111', 'ads_ingest substitui o intervalo enviado e ignora dias fora dele');

    -- clicks-only payload: upsert by gclid, stats untouched
    res := public.ads_ingest('{"customer_id":"1234567890","clicks":[{"gclid":"G-T7-1","day":"2026-11-10","campaign_id":"111","ad_group_id":"901","criterion_id":"7001","keyword_text":"apartamento sbc","match_type":"PHRASE"}]}'::jsonb);
    select count(*) into n from public.ads_campaign_daily where customer_id = '1234567890';
    out := out || extensions.is(n, 2, 'payload so de cliques nao mexe no custo');

    st := null;
    begin
      perform public.ads_ingest('{"customer_id":"12-34"}'::jsonb);
    exception when others then st := sqlstate;
    end;
    out := out || extensions.is(st, '22023', 'customer_id invalido e recusado');
    out := out || extensions.is(has_function_privilege('anon', 'public.ads_ingest(jsonb)', 'execute'), false, 'anon nao executa ads_ingest');
    out := out || extensions.is(has_function_privilege('authenticated', 'public.ads_ingest(jsonb)', 'execute'), false, 'authenticated nao executa ads_ingest');

    -- sessions + leads
    insert into public.sessions(id, env, started_at, last_event_at, gclid, campaign_id, adgroup_id, keyword, utm_source, utm_medium, utm_campaign, is_bot) values
      (s_g, 'production', '2026-11-10 14:00+00', '2026-11-10 14:05+00', 'G-T7-1', null, null, null, 'google', 'cpc', null, false),
      (s_c, 'production', '2026-11-10 15:00+00', '2026-11-10 15:05+00', 'G-T7-UNKNOWN', '111', '901', 'Lancamento SBC', 'google', 'cpc', null, false),
      (s_u, 'production', '2026-11-10 16:00+00', '2026-11-10 16:05+00', null, null, null, null, 'google', 'cpc', 'sbc pesquisa', false),
      (s_n, 'production', '2026-11-10 17:00+00', '2026-11-10 17:05+00', null, null, null, null, null, null, null, false),
      (s_st, 'staging', '2026-11-10 18:00+00', '2026-11-10 18:05+00', 'G-T7-ST', null, null, null, null, null, null, false),
      (s_unk, 'production', '2026-11-10 19:00+00', '2026-11-10 19:05+00', null, '999', null, null, 'google', 'cpc', null, false),
      (s_kw2, 'production', '2026-11-10 20:00+00', '2026-11-10 20:05+00', null, '111', '901', 'casa sbc', 'google', 'cpc', null, false);
    insert into public.sessions(id, env, started_at, last_event_at, fbclid, campaign_id, utm_source, utm_medium, utm_campaign, is_bot) values
      (s_meta, 'production', '2026-11-10 19:10+00', '2026-11-10 19:15+00', 'FB-T7', '111', 'facebook', 'paid', null, false),
      (s_fb, 'production', '2026-11-10 19:20+00', '2026-11-10 19:25+00', null, null, 'facebook', 'paid', 'SBC Pesquisa', false);
    insert into public.leads(id, env, phone_e164, first_session_id, submitted_at) values
      (l_g, 'production', '+5511900000701', s_g, '2026-11-10 14:04+00'),
      (l_c, 'production', '+5511900000702', s_c, '2026-11-10 15:04+00'),
      (l_u, 'production', '+5511900000703', s_u, '2026-11-11 02:30+00'),  -- 23:30 of 11-10 in Sao Paulo
      (l_n, 'production', '+5511900000704', s_n, '2026-11-10 17:04+00'),
      (l_st, 'staging', '+5511900000705', s_st, '2026-11-10 18:04+00'),
      (l_meta, 'production', '+5511900000706', s_meta, '2026-11-10 19:14+00'),
      (l_fb, 'production', '+5511900000707', s_fb, '2026-11-10 19:24+00'),
      (l_unk, 'production', '+5511900000708', s_unk, '2026-11-10 19:04+00'),
      (l_kw2, 'production', '+5511900000709', s_kw2, '2026-11-10 20:04+00');

    insert into auth.users(id, aud, role, email) values
      (admin_uid, 'authenticated', 'authenticated', 'admin-t7@example.invalid'),
      (plain_uid, 'authenticated', 'authenticated', 'plain-t7@example.invalid');
    insert into public.profiles(user_id, role) values (admin_uid, 'admin');

    perform set_config('request.jwt.claims', json_build_object('sub', admin_uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', admin_uid::text, true);
    set local role authenticated;

    select method || '/' || campaign_id || '/' || coalesce(criterion_id, '-') || '/' || coalesce(keyword_text, '-') || '/' || day
      into v from public.panel_ads_lead_attribution where lead_id = l_g;
    out := out || extensions.is(v, 'gclid/111/7001/apartamento sbc/2026-11-10', 'lead pelo gclid: campanha e palavra-chave exatas');
    select method || '/' || campaign_id || '/' || coalesce(criterion_id, '-') || '/' || coalesce(keyword_text, '-')
      into v from public.panel_ads_lead_attribution where lead_id = l_c;
    out := out || extensions.is(v, 'campaign_id/111/7002/lancamento sbc', 'gclid desconhecido: campaign_id da URL e palavra-chave pelo grupo');
    select method || '/' || campaign_id || '/' || coalesce(criterion_id, '-') || '/' || day
      into v from public.panel_ads_lead_attribution where lead_id = l_u;
    out := out || extensions.is(v, 'utm_campaign/111/-/2026-11-10', 'utm_campaign igual ao nome da campanha (sem caixa); dia em Sao Paulo');
    select count(*) into n from public.panel_ads_lead_attribution where lead_id = l_n;
    out := out || extensions.is(n, 0, 'lead sem sinal de anuncio nao entra');
    select count(*) into n from public.panel_ads_lead_attribution where lead_id = l_meta;
    out := out || extensions.is(n, 0, 'anuncio da Meta com campaign_id nao vira lead do Google');
    select count(*) into n from public.panel_ads_lead_attribution where lead_id = l_fb;
    out := out || extensions.is(n, 0, 'utm_campaign do Facebook com nome igual a campanha do Google nao conta');
    select count(*) into n from public.panel_ads_lead_attribution where lead_id = l_unk;
    out := out || extensions.is(n, 0, 'campaign_id que nao existe no Google Ads nao conta');

    select day || ':' || cost || '/' || clicks || '/' || leads || '/' || google_conversions || '/' || coalesce(campaign_name, '-')
      into v from public.panel_ads_campaigns_daily where campaign_id = '111' and day = '2026-11-10';
    out := out || extensions.is(v, '2026-11-10:80.5000000000000000/40/4/1/SBC Pesquisa', 'campanha no dia: custo em reais, cliques, 4 leads de producao (staging e Meta fora)');
    select cost::text || '/' || leads into v from public.panel_ads_campaigns_daily where campaign_id = '111' and day = '2026-11-09';
    out := out || extensions.is(v, '99.0000000000000000/0', 'dia so com custo: 0 leads');

    select string_agg(coalesce(criterion_id, '-') || ':' || coalesce(keyword_text, '-') || ':' || leads || ':' || cost::numeric(12,2), ',' order by criterion_id nulls last, keyword_text nulls last)
      into v from public.panel_ads_keywords_daily where campaign_id = '111' and day = '2026-11-10';
    out := out || extensions.is(v, '7001:apartamento sbc:1:60.00,7002:lancamento sbc:1:20.50,-:casa sbc:1:0.00,-:-:1:0.00', 'palavras-chave: custo e leads; leads sem palavra-chave conhecida em linhas separadas');
    reset role;

    -- authenticated but not admin
    perform set_config('request.jwt.claims', json_build_object('sub', plain_uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', plain_uid::text, true);
    set local role authenticated;
    select (select count(*) from public.ads_campaign_daily) + (select count(*) from public.ads_clicks)
         + (select count(*) from public.ads_sync_runs) + (select count(*) from public.panel_ads_campaigns_daily)
         + (select count(*) from public.panel_ads_keywords_daily) + (select count(*) from public.panel_ads_lead_attribution)
      into n;
    out := out || extensions.is(n, 0, 'nao admin nao ve nada de anuncios');
    reset role;

    foreach vw in array array['ads_campaign_daily','ads_keyword_daily','ads_clicks','ads_sync_runs',
                              'panel_ads_lead_attribution','panel_ads_campaigns_daily','panel_ads_keywords_daily'] loop
      anon_any := anon_any or has_table_privilege('anon', 'public.' || vw, 'select');
    end loop;
    out := out || extensions.is(anon_any, false, 'anon sem select em tabelas e views de anuncios');
    foreach vw in array array['panel_ads_lead_attribution','panel_ads_campaigns_daily','panel_ads_keywords_daily'] loop
      inv_all := inv_all and coalesce((select 'security_invoker=true' = any(c.reloptions) from pg_class c where c.oid = ('public.' || vw)::regclass), false);
    end loop;
    out := out || extensions.is(inv_all, true, 'views de anuncios sao security_invoker');
    select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relrowsecurity and c.relname in ('ads_campaign_daily','ads_keyword_daily','ads_clicks','ads_sync_runs');
    out := out || extensions.is(n, 4, 'RLS ligado nas 4 tabelas de anuncios');
    select count(*) into n from cron.job where jobname = 'radar-purge-ads-clicks';
    out := out || extensions.is(n, 1, 'limpeza diaria de ads_clicks agendada');
    out := out || extensions.is(has_table_privilege('authenticated', 'public.panel_ads_campaigns_daily', 'select'), true, 'authenticated tem select nas views');

    out := out || array(select * from extensions.finish());
    raise exception 'ROLLBACK_TESTS';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_TESTS' then raise; end if;
  end;
  return query select unnest(out);
end $$;

select * from pg_temp.run_tests();
