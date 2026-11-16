-- Radar / Task 2: lead functions tests (pgTAP). Self-contained, leaves no data behind.
-- Run through execute_sql (or psql). Everything happens inside a block that is rolled back.
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as $$
declare
  out text[] := '{}';
  sa1 uuid := '00000000-0000-0000-0000-0000000000a1';
  sa2 uuid := '00000000-0000-0000-0000-0000000000a2';
  sa3 uuid := '00000000-0000-0000-0000-0000000000a3';
  vb1 uuid := '00000000-0000-0000-0000-0000000000b1';
  vb2 uuid := '00000000-0000-0000-0000-0000000000b2';
  tc1 uuid := '00000000-0000-0000-0000-0000000000c1';
  l1 uuid; l2 uuid; l_mail uuid; l_up uuid; l_ghost uuid; l_rd uuid; l_rd_exist uuid;
  st_null1 text; st_null2 text;
begin
  begin
    out := out || extensions.plan(26);

    -- setup: 3 sessions, 2 visitors, 4 events before the lead exists
    insert into public.visitors(id, env, first_seen_at, last_seen_at) values (vb1, 'staging', now(), now()), (vb2, 'staging', now(), now());
    insert into public.sessions(id, env, started_at) values (sa1, 'staging', now()), (sa2, 'staging', now()), (sa3, 'staging', now());
    insert into public.events(id, session_id, visitor_id, type, occurred_at) values
      (gen_random_uuid(), sa1, vb1, 'page_view', now()),
      (gen_random_uuid(), sa1, vb1, 'faq_open', now()),
      (gen_random_uuid(), sa2, vb1, 'page_view', now()),   -- other session, same visitor
      (gen_random_uuid(), sa3, vb2, 'page_view', now());   -- unrelated visitor

    -- record_lead: create + stitching
    l1 := public.record_lead('staging', '+5511940383680', '(11) 94038-3680', 'Teste', null, sa1, vb1, tc1);
    out := out || extensions.isnt(l1, null, 'cria lead');
    out := out || extensions.is((select count(*) from public.events where session_id = sa1 and lead_id = l1)::int, 2, 'costura eventos anteriores da sessão');
    out := out || extensions.is((select count(*) from public.events where session_id = sa2 and lead_id = l1)::int, 1, 'costura evento de outra sessão do mesmo visitor');
    out := out || extensions.is((select count(*) from public.events where session_id = sa3 and lead_id is not null)::int, 0, 'não costura evento de outro visitor');
    out := out || extensions.is(
      (select (submitted_at is not null and first_visitor_id = vb1 and first_session_id = sa1) from public.leads where id = l1),
      true, 'submitted_at e first_* gravados na criação');
    out := out || extensions.is(
      (select count(*) from public.lead_visitors where lead_id = l1 and visitor_id = vb1)::int
        + (select count(*) from public.visitors where id = vb1 and lead_id = l1)::int,
      2, 'lead_visitors e visitors.lead_id gravados');

    -- dedup by phone
    l2 := public.record_lead('staging', '+5511940383680', '11940383680', null, 't@x.com', null, null, null);
    out := out || extensions.is(l2, l1, 'mesmo telefone = mesmo lead');
    out := out || extensions.is((select count(*) from public.leads where phone_e164 = '+5511940383680')::int, 1, 'sem duplicata');
    out := out || extensions.is(
      (select (name = 'Teste' and email = 't@x.com' and first_session_id = sa1) from public.leads where id = l1),
      true, 'coalesce preserva nome, preenche e-mail, first_* intacto');

    -- email-only path (dedup case-insensitive) and phone upgrade
    l_mail := public.record_lead('staging', null, null, 'Maria', 'M@X.com', null, null, null);
    out := out || extensions.is(public.record_lead('staging', null, null, null, 'm@x.com', null, null, null), l_mail, 'e-mail sem telefone: mesmo lead (case-insensitive)');
    l_up := public.record_lead('staging', '+5511988887777', '11988887777', null, 'm@x.com', null, null, null);
    out := out || extensions.is(l_up, l_mail, 'telefone novo + e-mail conhecido = mesmo lead');
    out := out || extensions.is((select phone_e164 from public.leads where id = l_mail), '+5511988887777', 'telefone promovido no lead do e-mail');

    -- no identifier at all
    begin perform public.record_lead('staging', null, null, 'Ninguem', null, null, null, null); st_null1 := 'none';
    exception when others then st_null1 := sqlstate; end;
    out := out || extensions.is(st_null1, '22023', 'record_lead sem telefone e sem e-mail levanta exceção');

    -- session/visitor that do not exist (yet)
    l_ghost := public.record_lead('staging', '+5511977776666', null, 'Fantasma', null,
      '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', null);
    out := out || extensions.is(
      (select count(*) from public.leads where id = l_ghost)::int
        + (select count(*) from public.lead_visitors where lead_id = l_ghost)::int,
      1, 'tolera session/visitor inexistentes (sem lead_visitors)');

    -- tokens
    out := out || extensions.is((select first_use from public.consume_lead_token(tc1)), true, 'token: 1º uso');
    out := out || extensions.is((select thank_you_at is not null from public.leads where id = l1), true, 'token: thank_you_at gravado');
    out := out || extensions.is((select first_use from public.consume_lead_token(tc1)), false, 'token: 2º uso não conta');
    out := out || extensions.is((select count(*) from public.consume_lead_token(gen_random_uuid()))::int, 0, 'token inexistente: nada');
    perform public.record_lead('staging', '+5511940383680', null, null, null, sa1, vb1, tc1);
    out := out || extensions.is((select count(*) from public.lead_tokens where token = tc1 and used_at is not null)::int, 1, 'token repetido é idempotente (não duplica nem zera uso)');
    perform public.mark_lead_whatsapp(tc1);
    out := out || extensions.is((select whatsapp_at is not null from public.leads where id = l1), true, 'mark_lead_whatsapp grava whatsapp_at');

    -- RD webhook confirmation
    l_rd := public.confirm_rd_lead('+5511999990000', null, 'Popup', null);
    out := out || extensions.is(public.confirm_rd_lead('+5511999990000', null, 'Popup', null), l_rd, 'webhook repetido é idempotente');
    out := out || extensions.is(
      (select (rd_confirmed_at is not null and env = 'production' and submitted_at is null) from public.leads where id = l_rd),
      true, 'lead só do webhook: confirmado, production, submitted_at nulo');
    l_rd_exist := public.confirm_rd_lead('+5511940383680', null, null, 'rd-123');
    out := out || extensions.is(
      (select l_rd_exist = l1 and rd_lead_id = 'rd-123' and rd_confirmed_at is not null from public.leads where id = l1),
      true, 'webhook confirma lead existente (outro env) sem criar duplicata');
    begin perform public.confirm_rd_lead(null, null, 'Ninguem', null); st_null2 := 'none';
    exception when others then st_null2 := sqlstate; end;
    out := out || extensions.is(st_null2, '22023', 'confirm_rd_lead sem telefone e sem e-mail levanta exceção');

    -- privileges
    out := out || extensions.is(
      has_function_privilege('anon', 'public.record_lead(text,text,text,text,text,uuid,uuid,uuid)', 'execute')
        or has_function_privilege('authenticated', 'public.confirm_rd_lead(text,text,text,text)', 'execute')
        or has_function_privilege('anon', 'public.consume_lead_token(uuid)', 'execute')
        or has_function_privilege('authenticated', 'public.mark_lead_whatsapp(uuid)', 'execute'),
      false, 'anon/authenticated não executam as funções');
    out := out || extensions.is(
      has_function_privilege('service_role', 'public.record_lead(text,text,text,text,text,uuid,uuid,uuid)', 'execute')
        and has_function_privilege('service_role', 'public.confirm_rd_lead(text,text,text,text)', 'execute')
        and has_function_privilege('service_role', 'public.consume_lead_token(uuid)', 'execute')
        and has_function_privilege('service_role', 'public.mark_lead_whatsapp(uuid)', 'execute'),
      true, 'service_role executa as funções');

    out := out || array(select * from extensions.finish());
    raise exception 'ROLLBACK_TESTS';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_TESTS' then raise; end if;
  end;
  return query select unnest(out);
end $$;

select * from pg_temp.run_tests();
