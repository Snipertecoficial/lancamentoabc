-- Radar / Google Ads: raw reports for analysis (where people were, how each campaign is targeted, which
-- conversion actions exist and which ones produced the conversions). One row per report, replaced on each
-- sync; rows are a JSON array, read with jsonb_to_recordset. Admin-only read, written by ads-sync only.

create table public.ads_reports (
  customer_id text not null,
  report text not null check (report in ('locations_city', 'locations_detail', 'location_targets', 'conversion_actions', 'conversions_by_action')),
  date_from date,
  date_to date,
  rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array'),
  error text,
  synced_at timestamptz not null default now(),
  primary key (customer_id, report)
);

alter table public.ads_reports enable row level security;
revoke all on table public.ads_reports from public, anon, authenticated;
grant select on table public.ads_reports to authenticated;
grant all on table public.ads_reports to service_role;
create policy ads_reports_admin_select on public.ads_reports for select to authenticated using ((select public.is_admin()));

-- reports: [{report, date_from?, date_to?, rows: [...], error?}]
create function public.ads_reports_ingest(cust text, reports jsonb) returns int
language plpgsql security definer set search_path = ''
as $$
declare n int := 0;
begin
  if cust is null or cust !~ '^[0-9]{6,12}$' then
    raise exception 'ads_reports_ingest: invalid customer_id' using errcode = '22023';
  end if;
  insert into public.ads_reports (customer_id, report, date_from, date_to, rows, error, synced_at)
  select cust, r.report, r.date_from, r.date_to, coalesce(r.rows, '[]'::jsonb), left(r.error, 500), now()
  from jsonb_to_recordset(case when jsonb_typeof(reports) = 'array' then reports else '[]'::jsonb end)
    as r(report text, date_from date, date_to date, rows jsonb, error text)
  where r.report is not null
  on conflict (customer_id, report) do update set
    date_from = excluded.date_from, date_to = excluded.date_to, rows = excluded.rows,
    error = excluded.error, synced_at = excluded.synced_at;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.ads_reports_ingest(text, jsonb) from public, anon, authenticated;
grant execute on function public.ads_reports_ingest(text, jsonb) to service_role;
