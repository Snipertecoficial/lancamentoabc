-- Radar / Retention: purge_old_tracking() (pgTAP). Self-contained, leaves no data behind.
-- Run through execute_sql (or psql). Everything happens inside a block that is rolled back.
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as $$
declare
  out text[] := '{}';
  res jsonb;
  l_id uuid := gen_random_uuid();
  v_old uuid := gen_random_uuid();      -- anonymous, old
  v_lead uuid := gen_random_uuid();     -- old, linked to lead via lead_id only (no session)
  v_lv uuid := gen_random_uuid();       -- old, only in lead_visitors
  v_sess uuid := gen_random_uuid();     -- old, referenced by a recent session
  v_gone uuid := gen_random_uuid();     -- old anonymous, unreferenced
  v_fv uuid := gen_random_uuid();       -- old anonymous, only referenced by leads.first_visitor_id
  v_new uuid := gen_random_uuid();      -- recent
  s_old_ev uuid := gen_random_uuid();   -- old session with old + recent event
  s_old_empty uuid := gen_random_uuid();-- old session, no events
  s_first uuid := gen_random_uuid();    -- old session, lead's first_session
  s_new uuid := gen_random_uuid();      -- recent session
  e_old uuid := gen_random_uuid();
  e_new uuid := gen_random_uuid();
  tok uuid := gen_random_uuid();
begin
  begin
    out := out || extensions.plan(18);

    insert into public.leads(id, env, phone_e164, first_session_id)
      values (l_id, 'staging', '+5511999990005', null);
    insert into public.visitors(id, env, first_seen_at, last_seen_at, lead_id) values
      (v_old,  'staging', now() - interval '15 months', now() - interval '14 months', null),
      (v_lead, 'staging', now() - interval '15 months', now() - interval '14 months', l_id),
      (v_lv,   'staging', now() - interval '15 months', now() - interval '14 months', null),
      (v_sess, 'staging', now() - interval '15 months', now() - interval '14 months', null),
      (v_fv,   'staging', now() - interval '15 months', now() - interval '14 months', null),
      (v_gone, 'staging', now() - interval '15 months', now() - interval '14 months', null),
      (v_new,  'staging', now() - interval '1 day',     now() - interval '1 day',     null);
    insert into public.lead_visitors(lead_id, visitor_id) values (l_id, v_lv);
    insert into public.sessions(id, visitor_id, env, started_at, last_event_at) values
      (s_old_ev,    v_old, 'staging', now() - interval '14 months', now() - interval '14 months'),
      (s_old_empty, v_old, 'staging', now() - interval '14 months', now() - interval '14 months'),
      (s_first,     null,  'staging', now() - interval '14 months', now() - interval '14 months'),
      (s_new,       v_sess,'staging', now() - interval '1 day',     now() - interval '1 day');
    update public.leads set first_session_id = s_first, first_visitor_id = v_fv where id = l_id;
    insert into public.events(id, session_id, type, occurred_at) values
      (e_old, s_old_ev, 'page_view', now() - interval '14 months'),
      (e_new, s_old_ev, 'page_view', now() - interval '1 day');
    insert into public.lead_tokens(token, lead_id, created_at) values (tok, l_id, now() - interval '14 months');
    insert into public.rd_webhook_raw(received_at, payload) values
      (now() - interval '14 months', '{"t":"old"}'), (now() - interval '1 day', '{"t":"new"}');

    -- permissions
    out := out || extensions.is(has_function_privilege('anon', 'public.purge_old_tracking()', 'execute'), false, 'anon não executa');
    out := out || extensions.is(has_function_privilege('authenticated', 'public.purge_old_tracking()', 'execute'), false, 'authenticated não executa');
    out := out || extensions.is(has_function_privilege('service_role', 'public.purge_old_tracking()', 'execute'), true, 'service_role executa');

    res := public.purge_old_tracking();
    out := out || extensions.ok(jsonb_typeof(res) = 'object', 'retorna jsonb com contagens');

    -- events
    out := out || extensions.is((select count(*) from public.events where id = e_old)::int, 0, 'evento antigo apagado');
    out := out || extensions.is((select count(*) from public.events where id = e_new)::int, 1, 'evento recente mantido');
    out := out || extensions.is((res->>'events')::int >= 1, true, 'contagem events >= 1');

    -- sessions
    out := out || extensions.is((select count(*) from public.sessions where id = s_old_empty)::int, 0, 'sessão antiga sem eventos apagada');
    out := out || extensions.is((select count(*) from public.sessions where id = s_old_ev)::int, 1, 'sessão antiga com evento recente mantida');
    out := out || extensions.is((select count(*) from public.sessions where id = s_first)::int, 1, 'sessão antiga que é first_session do lead mantida');
    out := out || extensions.is((select count(*) from public.sessions where id = s_new)::int, 1, 'sessão recente mantida');

    -- visitors
    out := out || extensions.is((select count(*) from public.visitors where id = v_gone)::int, 0, 'visitor anônimo antigo sem referências apagado');
    out := out || extensions.is((select count(*) from public.visitors where id = v_new)::int, 1, 'visitor recente mantido');
    out := out || extensions.is((select count(*) from public.visitors where id = v_fv)::int, 1, 'visitor antigo referenciado só por leads.first_visitor_id mantido');
    out := out || extensions.is(
      (select count(*) from public.visitors where id in (v_lead, v_lv, v_old))::int, 3,
      'visitors com lead / em lead_visitors / ainda referenciados por sessão mantidos');

    -- leads, tokens, lead_visitors untouched
    out := out || extensions.is(
      (select count(*) from public.leads where id = l_id)::int
      + (select count(*) from public.lead_tokens where token = tok)::int
      + (select count(*) from public.lead_visitors where lead_id = l_id and visitor_id = v_lv)::int, 3,
      'lead, token e lead_visitors intactos');

    -- rd_webhook_raw
    out := out || extensions.is(
      (select array_agg(payload->>'t' order by payload->>'t') from public.rd_webhook_raw
        where payload->>'t' in ('old','new')), array['new'], 'rd_webhook_raw antigo apagado, recente mantido');

    -- idempotent: second run does not error
    res := public.purge_old_tracking();
    out := out || extensions.ok(res is not null, 'segunda execução idempotente');

    out := out || array(select * from extensions.finish());
    raise exception 'ROLLBACK_TESTS';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_TESTS' then raise; end if;
  end;
  return query select unnest(out);
end $$;

select * from pg_temp.run_tests();
