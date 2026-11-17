-- Radar / Plan 2 Task 1: panel views tests (pgTAP). Self-contained, leaves no data behind.
-- Run through execute_sql (or psql). Everything happens inside a block that is rolled back.
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as $$
declare
  out text[] := '{}';
  admin_uid uuid := '00000000-0000-0000-0000-0000000003ad';
  plain_uid uuid := '00000000-0000-0000-0000-0000000003ae';
  v1 uuid := '00000000-0000-0000-0000-0000000003b1';
  s1 uuid := '00000000-0000-0000-0000-0000000003a1';   -- L1: gclid, human, full funnel
  s2a uuid := '00000000-0000-0000-0000-0000000003a2';  -- L2 first session (fbclid)
  s2b uuid := '00000000-0000-0000-0000-0000000003a3';  -- L2 second session
  s3 uuid := '00000000-0000-0000-0000-0000000003a4';   -- L3 first session (no visitor)
  s_live uuid := '00000000-0000-0000-0000-0000000003a5';
  s_old uuid := '00000000-0000-0000-0000-0000000003a6';
  s_bot uuid := '00000000-0000-0000-0000-0000000003a7';
  l1 uuid := '00000000-0000-0000-0000-0000000003c1';
  l2 uuid := '00000000-0000-0000-0000-0000000003c2';
  l3 uuid := '00000000-0000-0000-0000-0000000003c3';
  v text; n int; arr text[]; r record; base record; today date;
  views text[] := array['panel_leads','panel_lead_events','panel_sessions_live','panel_funnel_daily','panel_campaigns'];
  vw text; anon_any boolean := false; auth_all boolean := true; inv_all boolean := true; st text;
begin
  begin
    out := out || extensions.plan(20);
    today := (timezone('America/Sao_Paulo', now()))::date;

    -- baseline of the shared funnel bucket (real staging data may exist)
    select coalesce(sum(visits),0) visits, coalesce(sum(watched_video),0) watched_video, coalesce(sum(reached_form),0) reached_form,
           coalesce(sum(started_form),0) started_form, coalesce(sum(submitted),0) submitted, coalesce(sum(thank_you),0) thank_you,
           coalesce(sum(whatsapp),0) whatsapp
      into base from public.panel_funnel_daily where day = today and env = 'staging' and origin = 'google_ads';

    -- fake admin + fake non-admin users (auth.users FK), rolled back with everything else
    insert into auth.users(id, aud, role, email) values
      (admin_uid, 'authenticated', 'authenticated', 'admin-t1@example.invalid'),
      (plain_uid, 'authenticated', 'authenticated', 'plain-t1@example.invalid');
    insert into public.profiles(user_id, role) values (admin_uid, 'admin');

    -- seed
    insert into public.leads(id, env, phone_e164, name, first_session_id, submitted_at, thank_you_at) values
      (l1, 'staging', '+5511900000101', 'Lead Um', s1, now(), now()),
      (l2, 'staging', '+5511900000102', 'Lead Dois', s2a, now(), null),
      (l3, 'staging', '+5511900000103', 'Lead Tres', s3, now(), null);
    insert into public.visitors(id, env, lead_id) values (v1, 'staging', l1);
    insert into public.sessions(id, visitor_id, env, started_at, last_event_at, landing_url, referrer, utm_source, utm_medium, utm_campaign, keyword, gclid, fbclid, device, is_bot) values
      (s1,  v1,   'staging', now() - interval '1 hour', now() - interval '1 hour', 'https://x.test/?gclid=1', null, 'google', 'cpc', 'camp-t1', 'apto-t1', 'g123', null, 'mobile', false),
      (s2a, null, 'staging', now() - interval '3 hour', now() - interval '3 hour', 'https://x.test/?fbclid=1', null, null, null, 'camp-t2', null, null, 'fb123', 'mobile', false),
      (s2b, null, 'staging', now() - interval '2 hour', now() - interval '2 hour', 'https://x.test/', null, null, null, null, null, null, null, 'desktop', false),
      (s3,  null, 'staging', now() - interval '4 hour', now() - interval '4 hour', 'https://x.test/?utm_source=newsletter', null, 'newsletter', 'email', 'camp3', null, null, null, 'desktop', false),
      (s_live, v1, 'staging', now() - interval '2 minute', now(), 'https://x.test/live', null, null, null, 'camp-live', null, null, null, 'desktop', false),
      (s_old,  null, 'staging', now() - interval '12 minute', now() - interval '10 minute', 'https://x.test/old', null, null, null, null, null, null, null, 'desktop', false),
      (s_bot,  null, 'staging', now() - interval '1 minute', now(), 'https://x.test/bot', null, null, null, null, null, null, null, 'desktop', true);
    insert into public.events(session_id, visitor_id, lead_id, type, name, section, props, occurred_at) values
      (s1, v1, l1, 'video', 'progress', null, '{"video":"main","pct":25}', now() - interval '59 minute'),
      (s1, v1, l1, 'video', 'progress', null, '{"video":"main","pct":75}', now() - interval '58 minute'),
      (s1, v1, l1, 'faq_open', null, null, '{"question":"Qual o valor do apartamento?"}', now() - interval '57 minute'),
      (s1, v1, l1, 'faq_open', null, null, '{"question":"Qual o valor do apartamento?"}', now() - interval '56 minute'),
      (s1, v1, l1, 'form_view', null, null, '{}', now() - interval '55 minute'),
      (s1, v1, l1, 'form_start', null, null, '{}', now() - interval '54 minute'),
      (s1, v1, l1, 'lead_submitted', null, null, '{"form_id":"f"}', now() - interval '53 minute'),
      (s1, v1, l1, 'thank_you_view', null, null, '{}', now() - interval '52 minute'),
      (s1, v1, l1, 'whatsapp_click', null, null, '{}', now() - interval '51 minute'),
      (s2a, null, l2, 'page_view', null, null, '{}', now() - interval '3 hour'),
      (s2b, null, l2, 'page_view', null, null, '{}', now() - interval '2 hour'),
      (s3, null, l3, 'page_view', null, null, '{}', now() - interval '4 hour'),
      (s_live, v1, null, 'section_view', null, 'hero', '{"seconds":3}', now() - interval '90 second'),
      (s_live, v1, null, 'section_view', null, 'plantas', '{"seconds":4}', now() - interval '30 second');

    -- admin
    perform set_config('request.jwt.claims', json_build_object('sub', admin_uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', admin_uid::text, true);
    set local role authenticated;

    select count(*) into n from public.panel_leads where id = l1;
    out := out || extensions.is(n, 1, 'admin ve o lead semeado em panel_leads');
    select stage into v from public.panel_leads where id = l1;
    out := out || extensions.is(v, 'chegou_obrigado', 'stage = chegou_obrigado (thank_you_at preenchido)');
    select origin into v from public.panel_leads where id = l1;
    out := out || extensions.is(v, 'google_ads', 'origin = google_ads (gclid)');
    select temperature into v from public.panel_leads where id = l1;
    out := out || extensions.is(v, 'quente', 'temperature = quente (video 75 + FAQ valor + pago + obrigado)');
    select video_max_pct::int, faq_questions into r from public.panel_leads where id = l1;
    out := out || extensions.is(r.video_max_pct, 75, 'video_max_pct = 75');
    out := out || extensions.is(r.faq_questions, array['Qual o valor do apartamento?'], 'faq_questions distintas');
    select utm_campaign into v from public.panel_leads where id = l3;
    out := out || extensions.is(v, 'camp3', 'lead sem visitor tem utm_campaign da primeira sessao');
    select stage || '/' || temperature || '/' || origin into v from public.panel_leads where id = l3;
    out := out || extensions.is(v, 'tentou/frio/other', 'lead frio: tentou, frio, other');
    select visits || '/' || temperature || '/' || origin into v from public.panel_leads where id = l2;
    out := out || extensions.is(v, '2/morno/meta_ads', 'lead com 2 sessoes: visits=2, morno, meta_ads');
    select count(distinct session_id) into n from public.panel_lead_events where lead_id = l2;
    out := out || extensions.is(n, 2, 'panel_lead_events traz eventos das duas sessoes');
    select count(*) into n from public.panel_sessions_live where id = s_old;
    out := out || extensions.is(n, 0, 'live exclui sessao de 10 min atras');
    select count(*) into n from public.panel_sessions_live where id = s_bot;
    out := out || extensions.is(n, 0, 'live exclui bots');
    select current_section || '/' || lead_id::text into v from public.panel_sessions_live where id = s_live;
    out := out || extensions.is(v, 'plantas/' || l1::text, 'live inclui sessao ativa com current_section e lead_id via visitor');
    select * into r from public.panel_funnel_daily where day = today and env = 'staging' and origin = 'google_ads';
    out := out || extensions.is(
      array[r.visits - base.visits, r.watched_video - base.watched_video, r.reached_form - base.reached_form, r.started_form - base.started_form,
            r.submitted - base.submitted, r.thank_you - base.thank_you, r.whatsapp - base.whatsapp]::int[],
      array[1,1,1,1,1,1,1], 'funnel_daily conta a sessao em cada etapa (delta sobre baseline)');
    select visits || '/' || leads || '/' || conversion_pct into v from public.panel_campaigns
      where env = 'staging' and origin = 'google_ads' and utm_campaign = 'camp-t1' and keyword = 'apto-t1';
    out := out || extensions.is(v, '1/1/100.00', 'campaigns: visits, leads, conversion_pct');
    reset role;

    -- authenticated but not admin
    perform set_config('request.jwt.claims', json_build_object('sub', plain_uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', plain_uid::text, true);
    set local role authenticated;
    select count(*) into n from public.panel_leads where id in (l1, l2, l3);
    out := out || extensions.is(n, 0, 'autenticado nao admin ve 0 leads');
    select count(*) into n from public.panel_sessions_live where id in (s_live);
    out := out || extensions.is(n, 0, 'autenticado nao admin ve 0 sessoes live');
    reset role;

    -- anon
    set local role anon;
    begin perform count(*) from public.panel_leads; st := 'none';
    exception when others then st := sqlstate; end;
    reset role;
    out := out || extensions.is(st, '42501', 'anon sem permissao em panel_leads');
    foreach vw in array views loop
      anon_any := anon_any or has_table_privilege('anon', 'public.' || vw, 'select');
      auth_all := auth_all and has_table_privilege('authenticated', 'public.' || vw, 'select');
      inv_all := inv_all and coalesce((select 'security_invoker=true' = any(c.reloptions) from pg_class c
        where c.oid = ('public.' || vw)::regclass), false);
    end loop;
    out := out || extensions.is(anon_any, false, 'anon nao tem select em nenhuma view');
    out := out || extensions.is(auth_all and inv_all, true, 'authenticated tem select e views sao security_invoker');

    out := out || array(select * from extensions.finish());
    raise exception 'ROLLBACK_TESTS';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_TESTS' then raise; end if;
  end;
  return query select unnest(out);
end $$;

select * from pg_temp.run_tests();
