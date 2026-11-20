-- The account may still run an older copy of the Radar script next to 3.0. An older copy answers
-- "Tipo de alteração desconhecido: <kind>" for the 3.0 edits; instead of failing the edit, put it
-- back in the queue so the 3.0 copy picks it up. The 24-hour expiry in ads_commands_claim still
-- ends the loop if no 3.0 copy is running.

create or replace function public.ads_commands_report(cust text, results jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare n int := 0;
begin
  if cust is null or cust !~ '^[0-9]{6,12}$' then
    raise exception 'ads_commands_report: invalid customer_id' using errcode = '22023';
  end if;
  update public.ads_commands a set
    status = case
      when r.ok then 'applied'
      when coalesce(r.error, '') like 'Tipo de alteração desconhecido:%' then 'pending'
      else 'failed' end,
    error = case
      when r.ok then null
      when coalesce(r.error, '') like 'Tipo de alteração desconhecido:%' then 'Um script antigo não reconheceu; aguardando o script 3.0.'
      else left(coalesce(nullif(btrim(r.error), ''), 'O Google Ads recusou a alteração.'), 500) end,
    sent_at = case when not r.ok and coalesce(r.error, '') like 'Tipo de alteração desconhecido:%' then null else a.sent_at end,
    done_at = case when not r.ok and coalesce(r.error, '') like 'Tipo de alteração desconhecido:%' then null else now() end
  from jsonb_to_recordset(case when jsonb_typeof(results) = 'array' then results else '[]'::jsonb end)
    as r(id bigint, ok boolean, error text)
  where a.id = r.id and a.status = 'sent' and a.customer_id = cust and r.ok is not null;
  get diagnostics n = row_count;
  return n;
end;
$function$;
