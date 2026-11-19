-- Radar script 3.0: new edits (keyword, radius, "Presença"/partners, primary conversion) and
-- diagnostic reports (quality score, why a campaign shows little, ad approval).

alter table public.ads_reports drop constraint ads_reports_report_check;
alter table public.ads_reports add constraint ads_reports_report_check check (report in (
  'locations_city', 'locations_detail', 'location_targets', 'conversion_actions', 'conversions_by_action',
  'keyword_quality', 'campaign_serving', 'ads_review'
));

alter table public.ads_commands drop constraint ads_commands_kind_check;
alter table public.ads_commands add constraint ads_commands_kind_check check (kind in (
  'campaign_status', 'campaign_budget', 'keyword_status', 'campaign_negative',
  'keyword_add', 'campaign_location', 'campaign_settings', 'conversion_goal'
));

alter table public.ads_commands drop constraint ads_commands_value_valid;
alter table public.ads_commands add constraint ads_commands_value_valid check (
  case kind
    when 'campaign_status' then (value ->> 'status') in ('ENABLED', 'PAUSED') and ad_group_id is null and criterion_id is null
    when 'keyword_status' then (value ->> 'status') in ('ENABLED', 'PAUSED') and ad_group_id is not null and criterion_id is not null
    when 'campaign_budget' then
      case when jsonb_typeof(value -> 'amount_micros') = 'number' then
        (value ->> 'amount_micros')::numeric between 1000000 and 10000000000
        and (value ->> 'amount_micros')::numeric % 10000 = 0
      else false end
    when 'campaign_negative' then
      jsonb_typeof(value -> 'text') = 'string'
      and length(btrim(value ->> 'text')) between 1 and 80
      and (value ->> 'match_type') in ('EXACT', 'PHRASE', 'BROAD')
    -- new keyword in an ad group
    when 'keyword_add' then
      ad_group_id is not null and criterion_id is null
      and jsonb_typeof(value -> 'text') = 'string'
      and length(btrim(value ->> 'text')) between 1 and 80
      and (value ->> 'match_type') in ('EXACT', 'PHRASE', 'BROAD')
    -- one radius around a point replaces the campaign's cities/radii
    when 'campaign_location' then
      ad_group_id is null and criterion_id is null
      and jsonb_typeof(value -> 'lat_micro') = 'number' and jsonb_typeof(value -> 'lng_micro') = 'number'
      and jsonb_typeof(value -> 'radius_km') = 'number'
      and (value ->> 'lat_micro')::numeric between -90000000 and 90000000
      and (value ->> 'lng_micro')::numeric between -180000000 and 180000000
      and (value ->> 'radius_km')::numeric between 1 and 100
    -- "Presença" and/or search partners
    when 'campaign_settings' then
      ad_group_id is null and criterion_id is null
      and (value ? 'geo_target_type' or value ? 'partner_network')
      and (not value ? 'geo_target_type' or (value ->> 'geo_target_type') in ('PRESENCE', 'PRESENCE_OR_INTEREST'))
      and (not value ? 'partner_network' or jsonb_typeof(value -> 'partner_network') = 'boolean')
    -- account-level conversion action: campaign_id is '0'
    when 'conversion_goal' then
      campaign_id = '0' and ad_group_id is null and criterion_id is null
      and (value ->> 'conversion_action_id') ~ '^[0-9]{1,20}$'
      and jsonb_typeof(value -> 'primary') = 'boolean'
    else false
  end
);
