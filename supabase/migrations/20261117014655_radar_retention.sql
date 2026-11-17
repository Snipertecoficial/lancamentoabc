-- Retenção: a política de privacidade promete no máximo 13 meses de eventos de navegação.
-- purge_old_tracking() apaga dados de navegação antigos (events -> sessions -> visitors; rd_webhook_raw)
-- e NUNCA toca em leads, lead_tokens, lead_visitors ou profiles. Roda diariamente às 06:00 UTC via pg_cron.
create or replace function public.purge_old_tracking()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  cutoff constant timestamptz := now() - interval '13 months';
  n_events bigint; n_sessions bigint; n_visitors bigint; n_raw bigint;
begin
  delete from public.events where occurred_at < cutoff;
  get diagnostics n_events = row_count;

  delete from public.sessions s
   where s.last_event_at < cutoff
     and not exists (select 1 from public.events e where e.session_id = s.id)
     and not exists (select 1 from public.leads l where l.first_session_id = s.id);
  get diagnostics n_sessions = row_count;

  delete from public.visitors v
   where v.last_seen_at < cutoff
     and v.lead_id is null
     and not exists (select 1 from public.sessions s where s.visitor_id = v.id)
     and not exists (select 1 from public.lead_visitors lv where lv.visitor_id = v.id);
  get diagnostics n_visitors = row_count;

  delete from public.rd_webhook_raw where received_at < cutoff;
  get diagnostics n_raw = row_count;

  return jsonb_build_object('events', n_events, 'sessions', n_sessions,
                            'visitors', n_visitors, 'rd_webhook_raw', n_raw);
end;
$$;
revoke all on function public.purge_old_tracking() from public, anon, authenticated;
grant execute on function public.purge_old_tracking() to service_role;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'radar-purge-old-tracking') then
    perform cron.unschedule('radar-purge-old-tracking');
  end if;
  perform cron.schedule('radar-purge-old-tracking', '0 6 * * *', $cron$select public.purge_old_tracking()$cron$);
end $$;
