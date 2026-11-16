-- Fix: email fallback must not merge into a lead that already has a different phone.
create or replace function public.record_lead(
  p_env text, p_phone_e164 text, p_phone_raw text, p_name text, p_email text,
  p_session_id uuid, p_visitor_id uuid, p_lead_token uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text := nullif(btrim(p_phone_e164), '');
  v_email text := nullif(btrim(p_email), '');
  v_name  text := nullif(btrim(p_name), '');
  v_lead  uuid;
  v_ft jsonb;
  v_lt jsonb;
  v_visitor_exists boolean := false;
begin
  if v_phone is null and v_email is null then
    raise exception 'record_lead: phone_e164 or email is required' using errcode = '22023';
  end if;

  if p_visitor_id is not null then
    select true, v.first_touch, v.last_touch into v_visitor_exists, v_ft, v_lt
    from public.visitors v where v.id = p_visitor_id;
    v_visitor_exists := coalesce(v_visitor_exists, false);
  end if;

  -- 1) existing lead by phone, 2) by e-mail (an e-mail-only lead gains the phone)
  if v_phone is not null then
    select l.id into v_lead from public.leads l where l.env = p_env and l.phone_e164 = v_phone;
  end if;
  if v_lead is null and v_email is not null then
    select l.id into v_lead from public.leads l
    where l.env = p_env and lower(l.email) = lower(v_email)
      and (v_phone is null or l.phone_e164 is null or l.phone_e164 = v_phone)
    order by l.created_at limit 1;
  end if;

  if v_lead is not null then
    begin
      update public.leads l set
        phone_e164   = coalesce(l.phone_e164, v_phone),
        phone_raw    = case when l.phone_e164 is null or l.phone_e164 = v_phone
                         then coalesce(nullif(btrim(p_phone_raw), ''), l.phone_raw) else l.phone_raw end,
        name         = coalesce(v_name, l.name),
        email        = coalesce(v_email, l.email),
        submitted_at = coalesce(l.submitted_at, now()),
        last_touch   = coalesce(v_lt, l.last_touch),
        updated_at   = now()
      where l.id = v_lead;
    exception when unique_violation then
      -- raced with another insert of the same phone: fall through to the upsert below
      v_lead := null;
    end;
  end if;

  if v_lead is null then
    if v_phone is not null then
      insert into public.leads as l (env, phone_e164, phone_raw, name, email, first_session_id, first_visitor_id,
                                     first_touch, last_touch, submitted_at)
      values (p_env, v_phone, nullif(btrim(p_phone_raw), ''), v_name, v_email, p_session_id, p_visitor_id,
              v_ft, v_lt, now())
      on conflict (env, phone_e164) do update set
        phone_raw    = coalesce(excluded.phone_raw, l.phone_raw),
        name         = coalesce(excluded.name, l.name),
        email        = coalesce(excluded.email, l.email),
        submitted_at = coalesce(l.submitted_at, now()),
        last_touch   = coalesce(excluded.last_touch, l.last_touch),
        updated_at   = now()
      returning l.id into v_lead;
    else
      insert into public.leads as l (env, phone_e164, phone_raw, name, email, first_session_id, first_visitor_id,
                                     first_touch, last_touch, submitted_at)
      values (p_env, null, nullif(btrim(p_phone_raw), ''), v_name, v_email, p_session_id, p_visitor_id,
              v_ft, v_lt, now())
      on conflict (env, lower(email)) where phone_e164 is null do update set
        phone_raw    = coalesce(excluded.phone_raw, l.phone_raw),
        name         = coalesce(excluded.name, l.name),
        submitted_at = coalesce(l.submitted_at, now()),
        last_touch   = coalesce(excluded.last_touch, l.last_touch),
        updated_at   = now()
      returning l.id into v_lead;
    end if;
  end if;

  -- link visitor (only if the visitor row exists)
  if v_visitor_exists then
    insert into public.lead_visitors (lead_id, visitor_id) values (v_lead, p_visitor_id)
    on conflict do nothing;
    update public.visitors set lead_id = v_lead where id = p_visitor_id;
  end if;

  -- stitch earlier anonymous events: same session, or any visitor known for this lead
  update public.events e set lead_id = v_lead
  where e.lead_id is null
    and ( (p_session_id is not null and e.session_id = p_session_id)
          or (p_visitor_id is not null and e.visitor_id = p_visitor_id)
          or e.visitor_id in (select lv.visitor_id from public.lead_visitors lv where lv.lead_id = v_lead) );

  if p_lead_token is not null then
    insert into public.lead_tokens (token, lead_id, session_id)
    values (p_lead_token, v_lead, p_session_id)
    on conflict (token) do nothing;
  end if;

  return v_lead;
end $$;

revoke execute on function public.record_lead(text,text,text,text,text,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.record_lead(text,text,text,text,text,uuid,uuid,uuid) to service_role;
