import { adsTotals, aggregateAdsCampaigns, aggregateAdsKeywords, matchTypeLabel } from "../lib/ads";

const campaignRows = [
  { day: "2026-11-09", campaign_id: "111", campaign_name: "SBC Pesquisa", channel: "SEARCH", impressions: 1000, clicks: 50, cost: "99.5", google_conversions: "2", leads: 1 },
  { day: "2026-11-10", campaign_id: "111", campaign_name: "SBC Pesquisa", channel: "SEARCH", impressions: 800, clicks: 40, cost: "80.5", google_conversions: "1", leads: 3 },
  { day: "2026-11-10", campaign_id: "222", campaign_name: "PMax", channel: "PERFORMANCE_MAX", impressions: 0, clicks: 0, cost: "0", google_conversions: "0", leads: 0 },
  { day: "2026-11-10", campaign_id: "333", campaign_name: null, channel: null, impressions: 0, clicks: 0, cost: "0", google_conversions: "0", leads: 2 },
];

test("aggregateAdsCampaigns soma os dias, calcula custo por lead, CPC e CTR, e ordena por investimento", () => {
  const out = aggregateAdsCampaigns(campaignRows);
  expect(out.map((c) => c.campaign_id)).toEqual(["111", "333", "222"]);
  const c = out[0];
  expect(c).toMatchObject({ campaign_name: "SBC Pesquisa", channel: "SEARCH", impressions: 1800, clicks: 90, cost: 180, google_conversions: 3, leads: 4 });
  expect(c.cpl).toBe(45);
  expect(c.cpc).toBe(2);
  expect(c.ctr).toBe(5);
});

test("sem cliques, impressoes ou leads os indicadores ficam nulos (nunca divisao por zero)", () => {
  const pmax = aggregateAdsCampaigns(campaignRows).find((c) => c.campaign_id === "222");
  expect(pmax.cpl).toBeNull();
  expect(pmax.cpc).toBeNull();
  expect(pmax.ctr).toBeNull();
});

test("adsTotals soma tudo", () => {
  const t = adsTotals(campaignRows);
  expect(t).toMatchObject({ cost: 180, clicks: 90, leads: 6, google_conversions: 3, cpl: 30, cpc: 2 });
  expect(adsTotals([])).toMatchObject({ cost: 0, leads: 0, cpl: null, cpc: null, ctr: null });
});

test("aggregateAdsKeywords junta por palavra-chave e guarda a linha sem palavra-chave", () => {
  const out = aggregateAdsKeywords([
    { day: "2026-11-09", campaign_id: "111", campaign_name: "SBC", ad_group_id: "901", ad_group_name: "Aptos", criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE", impressions: 10, clicks: 5, cost: "10", google_conversions: "0", leads: 1 },
    { day: "2026-11-10", campaign_id: "111", campaign_name: "SBC", ad_group_id: "901", ad_group_name: "Aptos", criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE", impressions: 10, clicks: 5, cost: "30", google_conversions: "1", leads: 1 },
    { day: "2026-11-10", campaign_id: "111", campaign_name: "SBC", ad_group_id: null, criterion_id: null, keyword_text: null, impressions: 0, clicks: 0, cost: "0", google_conversions: "0", leads: 2 },
  ]);
  expect(out).toHaveLength(2);
  expect(out[0]).toMatchObject({ criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE", cost: 40, leads: 2, cpl: 20, cpc: 4 });
  expect(out[1]).toMatchObject({ criterion_id: null, keyword_text: null, leads: 2, cpl: null });
});

test("leads sem custo no periodo nao viram custo por lead zero", () => {
  const [c] = aggregateAdsCampaigns([{ day: "2026-11-10", campaign_id: "9", impressions: 0, clicks: 0, cost: "0", google_conversions: "0", leads: 3 }]);
  expect(c.cpl).toBeNull();
});

test("palavras-chave sem estatistica do Google ficam separadas pelo texto", () => {
  const out = aggregateAdsKeywords([
    { day: "2026-11-10", campaign_id: "1", ad_group_id: "9", criterion_id: null, keyword_text: "casa sbc", cost: "0", leads: 1 },
    { day: "2026-11-10", campaign_id: "1", ad_group_id: "9", criterion_id: null, keyword_text: "apto sbc", cost: "0", leads: 2 },
  ]);
  expect(out.map((k) => [k.keyword_text, k.leads])).toEqual([["apto sbc", 2], ["casa sbc", 1]]);
});

test("matchTypeLabel traduz o tipo de correspondencia", () => {
  expect(matchTypeLabel("EXACT")).toBe("exata");
  expect(matchTypeLabel("phrase")).toBe("frase");
  expect(matchTypeLabel("BROAD")).toBe("ampla");
  expect(matchTypeLabel(null)).toBeNull();
});
