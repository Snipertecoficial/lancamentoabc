-- Radar fix B: auto-link events to a lead on insert (events ingested after identification
-- were left with lead_id = null). Rules, in order: visitors.lead_id, most recent lead_tokens
-- row of the session, leads.first_session_id.

create index if not exists lead_tokens_session_id_idx on public.lead_tokens (session_id, created_at desc);
create index if not exists leads_first_session_id_idx on public.leads (first_session_id);

create or replace function public.events_autolink_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is null then
    new.lead_id := coalesce(
      (select v.lead_id from public.visitors v where v.id = new.visitor_id),
      (select t.lead_id from public.lead_tokens t where t.session_id = new.session_id order by t.created_at desc limit 1),
      (select l.id from public.leads l where l.first_session_id = new.session_id order by l.created_at desc limit 1)
    );
  end if;
  return new;
end $$;

revoke execute on function public.events_autolink_lead() from public, anon, authenticated;

create trigger events_autolink_lead_trg
  before insert on public.events
  for each row execute function public.events_autolink_lead();

-- Backfill (same rules)
update public.events e
set lead_id = coalesce(
  (select v.lead_id from public.visitors v where v.id = e.visitor_id),
  (select t.lead_id from public.lead_tokens t where t.session_id = e.session_id order by t.created_at desc limit 1),
  (select l.id from public.leads l where l.first_session_id = e.session_id order by l.created_at desc limit 1)
)
where e.lead_id is null;
