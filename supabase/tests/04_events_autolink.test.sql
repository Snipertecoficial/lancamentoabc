-- Radar / fix B: events auto-link to a lead on insert (pgTAP). Self-contained, leaves no data behind.
-- Run through execute_sql (or psql). Everything happens inside a block that is rolled back.
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as $$
declare
  out text[] := '{}';
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); s3 uuid := gen_random_uuid();
  s4 uuid := gen_random_uuid(); s5 uuid := gen_random_uuid(); s6 uuid := gen_random_uuid();
  v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid();
  tk uuid := gen_random_uuid();
  l1 uuid; l_other uuid; l_fs uuid;
  e_a uuid := gen_random_uuid(); e_b uuid := gen_random_uuid(); e_c uuid := gen_random_uuid();
  e_d uuid := gen_random_uuid(); e_e uuid := gen_random_uuid(); e_f uuid := gen_random_uuid();
begin
  begin
    out := out || extensions.plan(6);

    insert into public.visitors(id, env, first_seen_at, last_seen_at) values (v1, 'staging', now(), now()), (v2, 'staging', now(), now());
    insert into public.sessions(id, env, started_at) values
      (s1, 'staging', now()), (s2, 'staging', now()), (s3, 'staging', now()),
      (s4, 'staging', now()), (s5, 'staging', now()), (s6, 'staging', now());

    -- lead 1 identified via record_lead in session s1 (visitor v1, token tk)
    l1 := public.record_lead('staging', '+5511900000201', '11900000201', 'Auto Link', null, s1, v1, tk);
    -- lead whose only link is first_session_id (no token row for s4)
    insert into public.leads(env, phone_e164, first_session_id) values ('staging', '+5511900000202', s4) returning id into l_fs;
    -- an unrelated lead (used for the explicit-lead_id test)
    insert into public.leads(env, phone_e164) values ('staging', '+5511900000203') returning id into l_other;

    -- 1. same visitor, new session, after identification -> via visitors.lead_id
    insert into public.events(id, session_id, visitor_id, type, occurred_at) values (e_a, s2, v1, 'thank_you_view', now());
    out := out || extensions.is((select lead_id from public.events where id = e_a), l1, 'evento pós-identificação do mesmo visitor recebe lead_id');

    -- 2. same session as the token, no visitor (no consent) -> via lead_tokens
    insert into public.events(id, session_id, visitor_id, type, occurred_at) values (e_b, s1, null, 'whatsapp_click', now());
    out := out || extensions.is((select lead_id from public.events where id = e_b), l1, 'evento sem visitor na sessão do token recebe lead_id (lead_tokens)');

    -- 3. same session as leads.first_session_id, no visitor, no token -> via first_session_id
    insert into public.events(id, session_id, visitor_id, type, occurred_at) values (e_c, s4, null, 'page_view', now());
    out := out || extensions.is((select lead_id from public.events where id = e_c), l_fs, 'evento sem visitor na first_session do lead recebe lead_id');

    -- 4. unrelated session/visitor stays null
    insert into public.events(id, session_id, visitor_id, type, occurred_at) values (e_d, s3, v2, 'page_view', now());
    insert into public.events(id, session_id, visitor_id, type, occurred_at) values (e_e, s5, null, 'page_view', now());
    out := out || extensions.is((select count(*) from public.events where id in (e_d, e_e) and lead_id is not null)::int, 0, 'sessão/visitor sem relação continua com lead_id nulo');

    -- 5. explicit lead_id is not overwritten (visitor v1 maps to l1, but explicit says l_other)
    insert into public.events(id, session_id, visitor_id, lead_id, type, occurred_at) values (e_f, s2, v1, l_other, 'page_view', now());
    out := out || extensions.is((select lead_id from public.events where id = e_f), l_other, 'lead_id explícito não é sobrescrito');

    -- 6. trigger function is not executable by anon/authenticated/public
    out := out || extensions.is(
      to_regprocedure('public.events_autolink_lead()') is not null
        and not has_function_privilege('anon', to_regprocedure('public.events_autolink_lead()'), 'execute')
        and not has_function_privilege('authenticated', to_regprocedure('public.events_autolink_lead()'), 'execute'),
      true, 'função do trigger existe e não é executável por anon/authenticated');

    out := out || array(select * from extensions.finish());
    raise exception 'ROLLBACK_TESTS';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_TESTS' then raise; end if;
  end;
  return query select unnest(out);
end $$;

select * from pg_temp.run_tests();
