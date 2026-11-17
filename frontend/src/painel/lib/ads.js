// Google Ads cost per campaign / keyword, from panel_ads_campaigns_daily and panel_ads_keywords_daily
// (one row per Sao Paulo day). Ratios are null when the divisor is zero, so the screen shows "—".

const MATCH_TYPES = { EXACT: "exata", PHRASE: "frase", BROAD: "ampla" };

export function matchTypeLabel(t) {
  return MATCH_TYPES[String(t || "").toUpperCase()] || null;
}

function ratios(m) {
  return {
    ...m,
    cpl: m.leads > 0 ? m.cost / m.leads : null,
    cpc: m.clicks > 0 ? m.cost / m.clicks : null,
    ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null,
  };
}

function add(acc, r) {
  acc.impressions += Number(r.impressions) || 0;
  acc.clicks += Number(r.clicks) || 0;
  acc.cost += Number(r.cost) || 0;
  acc.google_conversions += Number(r.google_conversions) || 0;
  acc.leads += Number(r.leads) || 0;
  return acc;
}

const zero = () => ({ impressions: 0, clicks: 0, cost: 0, google_conversions: 0, leads: 0 });

// Most money first; ties by most leads.
const byCost = (a, b) => b.cost - a.cost || b.leads - a.leads;

export function adsTotals(rows) {
  return ratios((rows || []).reduce(add, zero()));
}

export function aggregateAdsCampaigns(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    const key = r.campaign_id;
    if (!map.has(key)) map.set(key, { campaign_id: key, campaign_name: null, channel: null, ...zero() });
    const c = add(map.get(key), r);
    if (r.campaign_name) c.campaign_name = r.campaign_name;
    if (r.channel) c.channel = r.channel;
  });
  return [...map.values()].map(ratios).sort(byCost);
}

export function aggregateAdsKeywords(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    const key = `${r.campaign_id}|${r.ad_group_id || ""}|${r.criterion_id || ""}`;
    if (!map.has(key)) {
      map.set(key, {
        key, campaign_id: r.campaign_id, campaign_name: null, ad_group_name: null,
        criterion_id: r.criterion_id || null, keyword_text: null, match_type: null, ...zero(),
      });
    }
    const k = add(map.get(key), r);
    ["campaign_name", "ad_group_name", "keyword_text", "match_type"].forEach((f) => { if (r[f]) k[f] = r[f]; });
  });
  return [...map.values()].map(ratios).sort(byCost);
}
