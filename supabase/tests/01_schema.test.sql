-- Radar / Task 1: schema + RLS tests (pgTAP). Self-contained, leaves no data behind.
-- Run through execute_sql (or psql). Everything happens inside a block that is rolled back.
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.run_tests() returns setof text
language plpgsql as $$
declare
  out text[] := '{}';
  st_ev text; st_leads text; n_anon int := -1;
  st_env text; st_type text; st_ok text; st_auth_ins text; st_dup text;
  n_user int; n_admin int;
  admin_id uuid := gen_random_uuid();
  user_id uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
begin
  begin
    out := out || extensions.plan(11);

    -- 1. RLS on all 8 tables
    out := out || extensions.is(
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relrowsecurity
          and c.relname in ('visitors','sessions','events','leads','lead_visitors','lead_tokens','rd_webhook_raw','profiles'))::int,
      8, 'RLS ligado nas 8 tabelas');

    -- setup as owner: one lead, one admin, one session
    insert into auth.users(id) values (admin_id), (user_id);
    insert into public.profiles(user_id, role) values (admin_id, 'admin');
    insert into public.leads(env, phone_e164) values ('staging', '+5511999990001');
    insert into public.sessions(id, env, started_at) values (sid, 'staging', now());

    -- anon (errors are captured; pgTAP is only called after the role is reset)
    execute 'set local role anon';
    begin
      insert into public.events(id, session_id, type, occurred_at) values (gen_random_uuid(), sid, 'page_view', now());
      st_ev := 'none';
    exception when others then st_ev := sqlstate; end;
    begin
      select count(*) into n_anon from public.leads;   -- permission denied counts as 0 visible rows
    exception when others then n_anon := 0; st_leads := sqlstate; end;
    execute 'reset role';
    out := out || extensions.is(st_ev, '42501', 'anon não insere events');
    out := out || extensions.is(n_anon, 0, 'anon não lê leads (1 lead existe)');

    -- constraints (owner role)
    begin
      insert into public.sessions(id, env, started_at) values (gen_random_uuid(), 'dev', now());
      st_env := 'none';
    exception when others then st_env := sqlstate; end;
    out := out || extensions.is(st_env, '23514', 'env inválido rejeitado');

    begin
      insert into public.events(id, session_id, type, occurred_at) values (gen_random_uuid(), sid, 'hack', now());
      st_type := 'none';
    exception when others then st_type := sqlstate; end;
    out := out || extensions.is(st_type, '23514', 'tipo de evento fora da lista rejeitado');

    out := out || extensions.has_function('public'::name, 'is_admin'::name, 'is_admin existe');

    begin
      insert into public.events(id, session_id, type, occurred_at) values (gen_random_uuid(), sid, 'page_view', now());
      st_ok := 'ok';
    exception when others then st_ok := sqlstate; end;
    out := out || extensions.is(st_ok, 'ok', 'controle positivo: evento válido é aceito pelo owner');

    begin
      insert into public.leads(env, phone_e164) values ('staging', '+5511999990001');
      st_dup := 'none';
    exception when others then st_dup := sqlstate; end;
    out := out || extensions.is(st_dup, '23505', 'único (env, phone_e164)');

    -- authenticated non-admin: 0 rows; cannot write
    perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n_user from public.leads;
    begin
      insert into public.events(id, session_id, type, occurred_at) values (gen_random_uuid(), sid, 'page_view', now());
      st_auth_ins := 'none';
    exception when others then st_auth_ins := sqlstate; end;
    execute 'reset role';
    out := out || extensions.is(n_user, 0, 'authenticated não-admin vê 0 leads');
    out := out || extensions.is(st_auth_ins, '42501', 'authenticated não insere events');

    -- authenticated admin: sees the lead
    perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n_admin from public.leads;
    execute 'reset role';
    out := out || extensions.is(n_admin, 1, 'admin autenticado vê o lead');

    out := out || array(select * from extensions.finish());
    raise exception 'ROLLBACK_TESTS';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_TESTS' then raise; end if;
  end;
  return query select unnest(out);
end $$;

select * from pg_temp.run_tests();
