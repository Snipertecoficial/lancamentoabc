// Runs the Google Ads script against fake AdsApp / UrlFetchApp / Utilities objects.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert";

const src = await Deno.readTextFile(new URL("./radar-ads-sync.js", import.meta.url));

type Row = Record<string, unknown>;
type Post = { url: string; opts: { headers: Record<string, string>; payload: string } };
type Body = Record<string, unknown>;
type Mutation = { ok: boolean; errors?: string[] } | Error;

function load(opts: {
  rowsFor?: (q: string) => Row[];
  reply?: (body: Body, n: number) => [number, string];
  commands?: unknown[][]; // one list per pull, in order; then empty
  preview?: boolean;
  mutate?: (op: Row) => Mutation;
} = {}) {
  const queries: string[] = [];
  const posts: Post[] = [];
  const logs: string[] = [];
  const mutations: Row[] = [];
  let sleeps = 0;
  const pulls = [...(opts.commands ?? [])];
  const AdsApp = {
    currentAccount: () => ({ getTimeZone: () => "America/Sao_Paulo", getCustomerId: () => "123-456-7890", getCurrencyCode: () => "BRL" }),
    getExecutionInfo: () => ({ isPreview: () => !!opts.preview }),
    search(q: string) {
      queries.push(q);
      const rows = (opts.rowsFor ?? rowsFor)(q);
      let i = 0;
      return { hasNext: () => i < rows.length, next: () => rows[i++] };
    },
    mutate(op: Row) {
      mutations.push(op);
      const r = opts.mutate ? opts.mutate(op) : { ok: true };
      if (r instanceof Error) throw r;
      return { isSuccessful: () => r.ok, getErrorMessages: () => r.errors ?? [], getResourceName: () => null };
    },
  };
  const UrlFetchApp = {
    fetch(url: string, o: Post["opts"]) {
      posts.push({ url, opts: o });
      const body = JSON.parse(o.payload) as Body;
      if (opts.reply) {
        const [code, text] = opts.reply(body, posts.length);
        return { getResponseCode: () => code, getContentText: () => text };
      }
      const out: Body = { ok: true, campaigns: 1, keywords: 1, clicks: 1 };
      if (body.pull) out.commands = pulls.shift() ?? [];
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(out) };
    },
  };
  const Utilities = { formatDate: () => "2026-11-17", sleep: () => { sleeps++; } };
  const Logger = { log: (s: string) => logs.push(s) };
  const api = new Function("AdsApp", "UrlFetchApp", "Utilities", "Logger",
    `${src}\nreturn { main, RADAR, radarAddDays_, radarCriterionId_ };`)(AdsApp, UrlFetchApp, Utilities, Logger);
  api.RADAR.SECRET = "chave-de-teste-1234567890";
  api.RADAR.WATCH_MINUTES = 0;
  const bodies = () => posts.map((p) => JSON.parse(p.opts.payload) as Body);
  return { api, queries, posts, bodies, logs, mutations, sleeps: () => sleeps };
}

const campaignRow = { segments: { date: "2026-11-16" }, campaign: { id: "111", name: "SBC Pesquisa", advertisingChannelType: "SEARCH" }, metrics: { impressions: "800", clicks: "40", costMicros: "80500000", conversions: 1 } };
const keywordRow = { segments: { date: "2026-11-16" }, campaign: { id: "111" }, adGroup: { id: "901", name: "Apartamentos" }, adGroupCriterion: { criterionId: "7001", keyword: { text: "apartamento sbc", matchType: "PHRASE" } }, metrics: { impressions: "600" } };
const clickRow = (gclid: string) => ({ clickView: { gclid, keyword: "customers/1234567890/adGroupCriteria/901~7001", keywordInfo: { text: "apartamento sbc", matchType: "PHRASE" } }, segments: { date: "2026-11-17" }, campaign: { id: "111" }, adGroup: { id: "901" } });
const stateCampaignRow = { campaign: { id: "111", name: "SBC Pesquisa", status: "ENABLED", advertisingChannelType: "SEARCH", biddingStrategyType: "MAXIMIZE_CONVERSIONS" }, campaignBudget: { id: "55", amountMicros: "100000000", explicitlyShared: false } };
const stateKeywordRow = { campaign: { id: "111" }, adGroup: { id: "901", name: "Apartamentos" }, adGroupCriterion: { criterionId: "7001", status: "ENABLED", keyword: { text: "apartamento sbc", matchType: "PHRASE" } } };
const termRow = { campaign: { id: "111" }, adGroup: { id: "901" }, searchTermView: { searchTerm: "apartamento 3 dormitorios sbc", status: "NONE" }, metrics: { impressions: "50", clicks: "4", costMicros: "9000000", conversions: 0 } };
const networkRow = { campaign: { id: "222" }, segments: { adNetworkType: "YOUTUBE" }, metrics: { impressions: "9000", clicks: "70", costMicros: "35000000", conversions: 0 } };

const cityRow = { campaign: { id: "111" }, userLocationView: { targetingLocation: true }, segments: { geoTargetCity: "geoTargetConstants/1001773" }, metrics: { impressions: "500", clicks: "30", costMicros: "60000000", conversions: 2 } };
const detailRow = { campaign: { id: "222" }, userLocationView: { targetingLocation: false }, segments: { geoTargetMostSpecificLocation: "geoTargetConstants/9999" }, metrics: { impressions: "90", clicks: "9", costMicros: "1000000", conversions: 0 } };
const targetRow = { campaign: { id: "111" }, campaignCriterion: { type: "PROXIMITY", negative: false, proximity: { radius: 15, radiusUnits: "KILOMETERS", address: { cityName: "São Bernardo do Campo" }, geoPoint: { latitudeInMicroDegrees: -23691000, longitudeInMicroDegrees: -46565000 } } } };
const settingsRow = { campaign: { id: "111", geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE_OR_INTEREST" }, networkSettings: { targetSearchNetwork: true, targetPartnerSearchNetwork: true, targetContentNetwork: false }, urlExpansionOptOut: null } };
const actionRow = { conversionAction: { id: "77", name: "RD - Formulário", status: "ENABLED", type: "WEBPAGE", category: "SUBMIT_LEAD_FORM", primaryForGoal: true, countingType: "ONE_PER_CLICK", includeInConversionsMetric: true } };
const byActionRow = { segments: { date: "2026-11-18", conversionAction: "customers/1234567890/conversionActions/77", conversionActionName: "RD - Formulário" }, campaign: { id: "222" }, metrics: { conversions: 1, allConversions: 1 } };
const geoRows = [
  { geoTargetConstant: { resourceName: "geoTargetConstants/1001773", name: "Sao Bernardo do Campo", canonicalName: "Sao Bernardo do Campo,State of Sao Paulo,Brazil", targetType: "City" } },
  { geoTargetConstant: { resourceName: "geoTargetConstants/9999", name: "Ipiranga", canonicalName: "Ipiranga,Sao Paulo,State of Sao Paulo,Brazil", targetType: "Neighborhood" } },
];

function rowsFor(q: string): Row[] {
  if (q.includes("FROM user_location_view") && q.includes("geo_target_city")) return [cityRow];
  if (q.includes("FROM user_location_view")) return [detailRow];
  if (q.includes("FROM campaign_criterion")) return [targetRow];
  if (q.includes("campaign.geo_target_type_setting")) return [settingsRow];
  if (q.includes("FROM conversion_action")) return [actionRow];
  if (q.includes("segments.conversion_action_name")) return [byActionRow];
  if (q.includes("FROM geo_target_constant")) return geoRows;
  if (q.includes("FROM campaign WHERE segments.date BETWEEN") && q.includes("segments.ad_network_type")) return [networkRow];
  if (q.includes("FROM campaign WHERE segments.date BETWEEN")) return [campaignRow];
  if (q.includes("FROM campaign WHERE campaign.status")) return [stateCampaignRow];
  if (q.includes("SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = 111")) return [{ campaign: { campaignBudget: "customers/1234567890/campaignBudgets/55" } }];
  if (q.includes("FROM keyword_view")) return [keywordRow];
  if (q.includes("FROM ad_group_criterion")) return [stateKeywordRow];
  if (q.includes("FROM search_term_view")) return [termRow];
  if (q.includes("FROM click_view") && q.includes("'2026-11-17'")) return [clickRow("g1"), clickRow("g2"), clickRow("g3"), { clickView: {} }];
  return [];
}

Deno.test("sem chave configurada o script para com mensagem clara e nao envia nada", () => {
  const { api, posts } = load();
  api.RADAR.SECRET = "COLE_AQUI_A_CHAVE_DO_RADAR";
  assertThrows(() => api.main(), Error, "cole a chave");
  assertEquals(posts.length, 0);
});

Deno.test("envia custos de 90 dias, situacao, termos/redes e cliques de 30 dias, com a chave no cabecalho", () => {
  const { api, queries, posts, bodies, logs } = load();
  api.main();

  assert(queries.some((q) => q.includes("FROM campaign WHERE segments.date BETWEEN '2026-08-20' AND '2026-11-17' AND metrics.impressions > 0") && !q.includes("ad_network_type")));
  assert(queries.some((q) => q.includes("FROM keyword_view WHERE segments.date BETWEEN '2026-08-20' AND '2026-11-17'")));
  const clickDays = queries.filter((q) => q.includes("FROM click_view")).map((q) => /'(\d{4}-\d{2}-\d{2})'/.exec(q)![1]);
  assertEquals(clickDays.length, 30);
  assertEquals([clickDays[0], clickDays[1], clickDays[29]], ["2026-11-17", "2026-11-16", "2026-10-19"]);

  assertEquals(posts[0].url, "https://cnsmmwbqfbaimwexmtkx.supabase.co/functions/v1/ads-sync");
  assertEquals(posts[0].opts.headers["x-radar-secret"], "chave-de-teste-1234567890");
  const b = bodies();
  assertEquals(b.map((x) => Object.keys(x).filter((k) => !["customer_id", "currency", "time_zone"].includes(k)).join()), ["pull", "stats", "state", "insights", "reports", "clicks"]);
  assertEquals(b[1].customer_id, "1234567890");
  const stats = b[1].stats as Body;
  assertEquals(stats.date_from, "2026-08-20");
  assertEquals(stats.campaigns, [{ day: "2026-11-16", campaign_id: "111", campaign_name: "SBC Pesquisa", channel: "SEARCH", impressions: "800", clicks: "40", cost_micros: "80500000", conversions: 1 }]);

  const state = b[2].state as { campaigns: Body[]; keywords: Body[] };
  assertEquals(state.campaigns[0], { campaign_id: "111", campaign_name: "SBC Pesquisa", status: "ENABLED", channel: "SEARCH", bidding_strategy: "MAXIMIZE_CONVERSIONS", budget_id: "55", budget_micros: "100000000", budget_shared: false });
  assertEquals(state.keywords[0], { campaign_id: "111", ad_group_id: "901", criterion_id: "7001", ad_group_name: "Apartamentos", keyword_text: "apartamento sbc", match_type: "PHRASE", status: "ENABLED" });

  const insights = b[3].insights as { date_from: string; search_terms: Body[]; networks: Body[] };
  assertEquals(insights.date_from, "2026-10-19");
  assertEquals(insights.search_terms[0].search_term, "apartamento 3 dormitorios sbc");
  assertEquals(insights.networks[0], { campaign_id: "222", network: "YOUTUBE", impressions: "9000", clicks: "70", cost_micros: "35000000", conversions: 0 });

  assertEquals((b[5].clicks as Body[]).map((c) => c.gclid), ["g1", "g2", "g3"]);
  assertEquals((b[5].clicks as Body[])[0], { gclid: "g1", day: "2026-11-17", campaign_id: "111", ad_group_id: "901", criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE" });
  assertEquals(logs[logs.length - 1], "Radar: ok.");
});

Deno.test("aplica as alteracoes do painel e devolve o resultado de cada uma", () => {
  const commands = [
    { id: 1, kind: "campaign_status", campaign_id: "111", value: { status: "PAUSED" } },
    { id: 2, kind: "campaign_budget", campaign_id: "111", value: { amount_micros: 150000000 } },
    { id: 3, kind: "keyword_status", campaign_id: "111", ad_group_id: "901", criterion_id: "7001", value: { status: "PAUSED" } },
    { id: 4, kind: "campaign_negative", campaign_id: "111", value: { text: "aluguel", match_type: "PHRASE" } },
    { id: 5, kind: "campaign_budget", campaign_id: "999", value: { amount_micros: 150000000 } },
    { id: 6, kind: "outra_coisa", campaign_id: "111", value: {} },
  ];
  const { api, bodies, mutations } = load({
    commands: [commands],
    mutate: (op) => (op.campaignCriterionOperation ? { ok: false, errors: ["DUPLICATE_KEYWORD"] } : { ok: true }),
  });
  api.main();

  assertEquals(mutations, [
    { campaignOperation: { update: { resourceName: "customers/1234567890/campaigns/111", status: "PAUSED" }, updateMask: "status" } },
    { campaignBudgetOperation: { update: { resourceName: "customers/1234567890/campaignBudgets/55", amountMicros: 150000000 }, updateMask: "amount_micros" } },
    { adGroupCriterionOperation: { update: { resourceName: "customers/1234567890/adGroupCriteria/901~7001", status: "PAUSED" }, updateMask: "status" } },
    { campaignCriterionOperation: { create: { campaign: "customers/1234567890/campaigns/111", negative: true, keyword: { text: "aluguel", matchType: "PHRASE" } } } },
  ]);
  const report = bodies()[1];
  assertEquals(report.results, [
    { id: 1, ok: true },
    { id: 2, ok: true },
    { id: 3, ok: true },
    { id: 4, ok: false, error: "DUPLICATE_KEYWORD" },
    { id: 5, ok: false, error: "Não encontrei o orçamento desta campanha." },
    { id: 6, ok: false, error: "Tipo de alteração desconhecido: outra_coisa" },
  ]);
});

Deno.test("erro do Google ao aplicar vira falha com a mensagem, sem parar o script", () => {
  const { api, bodies, logs } = load({
    commands: [[{ id: 9, kind: "campaign_status", campaign_id: "111", value: { status: "ENABLED" } }]],
    mutate: () => new Error("Authorization error"),
  });
  api.main();
  assertEquals(bodies()[1].results, [{ id: 9, ok: false, error: "Authorization error" }]);
  assertEquals(logs[logs.length - 1], "Radar: ok.");
});

Deno.test("em Visualizar nao puxa a fila do painel", () => {
  const { api, bodies, mutations, sleeps } = load({ preview: true, commands: [[{ id: 1, kind: "campaign_status", campaign_id: "111", value: { status: "PAUSED" } }]] });
  api.RADAR.WATCH_MINUTES = 25;
  api.main();
  assertEquals(bodies().some((b) => b.pull), false);
  assertEquals(mutations.length, 0);
  assertEquals(sleeps(), 0);
});

Deno.test("depois de sincronizar fica olhando a fila; ao aplicar algo, reenvia a situacao", () => {
  const { api, bodies, sleeps } = load({
    commands: [[], [], [{ id: 7, kind: "campaign_status", campaign_id: "111", value: { status: "PAUSED" } }]],
  });
  api.RADAR.WATCH_MINUTES = 3;
  api.RADAR.WATCH_SECONDS = 60;
  api.main();
  assertEquals(sleeps(), 3);
  const kinds = bodies().map((x) => Object.keys(x).filter((k) => !["customer_id", "currency", "time_zone"].includes(k)).join());
  // first pull, stats, state, insights, clicks, then 3 watch rounds: pull, pull+apply(results, state), pull
  assertEquals(kinds, ["pull", "stats", "state", "insights", "reports", "clicks", "pull", "pull", "results", "state", "pull"]);
});

Deno.test("falha ao buscar termos de pesquisa nao impede os custos e cliques", () => {
  const { api, bodies, logs } = load({
    rowsFor: (q) => {
      if (q.includes("search_term_view")) throw new Error("search_term_view indisponível");
      return rowsFor(q);
    },
  });
  api.main();
  const kinds = bodies().map((x) => Object.keys(x).filter((k) => !["customer_id", "currency", "time_zone"].includes(k)).join());
  assertEquals(kinds, ["pull", "stats", "state", "reports", "clicks"]);
  assert(logs.some((l) => l.includes("termos de pesquisa/redes não foram enviados")));
});

Deno.test("cliques vao em lotes", () => {
  const { api, bodies } = load();
  api.RADAR.CLICK_BATCH = 2;
  api.main();
  assertEquals(bodies().filter((b) => b.clicks).map((b) => (b.clicks as unknown[]).length), [2, 1]);
});

Deno.test("resposta diferente de 200 vira erro visivel no Google Ads", () => {
  const { api, posts } = load({ reply: () => [401, '{"ok":false,"error":"unauthorized"}'] });
  api.RADAR.SECRET = "chave-errada-1234567890";
  assertThrows(() => api.main(), Error, "Radar respondeu 401");
  assertEquals(posts.length, 1);
});

Deno.test("helpers de data e id do criterio", () => {
  const { api } = load();
  assertEquals(api.radarAddDays_("2026-03-01", -1), "2026-02-28");
  assertEquals(api.radarAddDays_("2026-12-31", 1), "2027-01-01");
  assertEquals(api.radarCriterionId_("customers/1/adGroupCriteria/2~345"), "345");
  assertEquals(api.radarCriterionId_(null), null);
});

Deno.test("relatorios: localizacao com nome do lugar, segmentacao, acoes de conversao e conversoes por acao", () => {
  const { api, bodies, queries } = load();
  api.main();
  const reports = bodies().find((b) => b.reports)!.reports as { report: string; date_from: string | null; rows: Body[]; error?: string }[];
  assertEquals(reports.map((r) => r.report), ["locations_city", "locations_detail", "location_targets", "conversion_actions", "conversions_by_action"]);
  assertEquals(reports[0].date_from, "2026-08-20");
  assertEquals(reports[0].rows[0], { campaign_id: "111", location: "geoTargetConstants/1001773", targeted: true, impressions: "500", clicks: "30", cost_micros: "60000000", conversions: 2, location_name: "Sao Bernardo do Campo", location_canonical: "Sao Bernardo do Campo,State of Sao Paulo,Brazil", location_type: "City" });
  assertEquals(reports[1].rows[0].location_name, "Ipiranga");
  assertEquals(reports[2].date_from, null);
  assertEquals(reports[2].rows[0], { kind: "criterion", campaign_id: "111", type: "PROXIMITY", negative: false, location: null, radius: 15, radius_units: "KILOMETERS", city: "São Bernardo do Campo", street: null, lat_micro: -23691000, lng_micro: -46565000 });
  assertEquals(reports[2].rows[1], { kind: "settings", campaign_id: "111", geo_target_type: "PRESENCE_OR_INTEREST", search_network: true, partner_network: true, content_network: false });
  assertEquals(reports[3].rows[0], { conversion_action_id: "77", name: "RD - Formulário", status: "ENABLED", type: "WEBPAGE", category: "SUBMIT_LEAD_FORM", primary_for_goal: true, counting_type: "ONE_PER_CLICK", in_conversions: true });
  assertEquals(reports[4].rows[0].conversion_action_name, "RD - Formulário");
  for (const r of reports) for (const row of r.rows) for (const k of Object.keys(row)) assert(/^[a-z_]{1,40}$/.test(k), k);
  assert(queries.some((q) => q.includes("geo_target_constant.resource_name IN ('geoTargetConstants/1001773', 'geoTargetConstants/9999')")));
  // Google Ads Scripts rejected this field on 19/11 (UNRECOGNIZED_FIELD) and the whole settings query failed.
  assert(!queries.some((q) => q.includes("url_expansion_opt_out")));
});

Deno.test("relatorio que falha manda o erro e os outros seguem", () => {
  const { api, bodies, logs } = load({
    rowsFor: (q) => {
      if (q.includes("FROM conversion_action")) throw new Error("conversion_action indisponível");
      if (q.includes("campaign.geo_target_type_setting")) throw new Error("campo inválido");
      return rowsFor(q);
    },
  });
  api.main();
  const reports = bodies().find((b) => b.reports)!.reports as { report: string; rows: Body[]; error?: string }[];
  assertEquals(reports.find((r) => r.report === "conversion_actions")!.error, "conversion_action indisponível");
  const targets = reports.find((r) => r.report === "location_targets")!;
  assertEquals(targets.rows[targets.rows.length - 1], { kind: "settings_error", error: "campo inválido" });
  assertEquals(reports.find((r) => r.report === "locations_city")!.rows.length, 1);
  assertEquals(logs[logs.length - 1], "Radar: ok.");
});
