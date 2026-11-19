import { assertEquals } from "jsr:@std/assert";
import { type AdsPayload, type CommandResult, handleAdsSync, LIMITS, parsePayload } from "./handler.ts";

const SECRET = "s3cr3t-radar-ads-0123456789";

const campaign = { day: "2026-11-10", campaign_id: "111", campaign_name: " SBC Pesquisa ", channel: "SEARCH", impressions: "800", clicks: "40", cost_micros: "80500000", conversions: 1.5 };
const keyword = { day: "2026-11-10", campaign_id: "111", ad_group_id: "901", criterion_id: "7001", ad_group_name: "Apartamentos", keyword_text: "apartamento sbc", match_type: "PHRASE", impressions: 600, clicks: 30, cost_micros: 60000000, conversions: 1 };
const click = { gclid: "Cj0KCQiA-abc_123", day: "2026-11-10", campaign_id: "111", ad_group_id: "901", criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE" };
const valid = {
  customer_id: "123-456-7890", currency: "BRL", time_zone: "America/Sao_Paulo",
  stats: { date_from: "2026-10-12", date_to: "2026-11-10", campaigns: [campaign], keywords: [keyword] },
  clicks: [click],
};

function mk(opts: { body?: string; secret?: string | undefined; header?: string | null; method?: string; fail?: boolean } = {}) {
  const got: AdsPayload[] = [];
  const calls: string[] = [];
  const deps = {
    secret: "secret" in opts ? opts.secret : SECRET,
    ingest: (p: AdsPayload) => {
      got.push(p);
      calls.push("ingest");
      return opts.fail ? Promise.reject(new Error("db down")) : Promise.resolve({ campaigns: 1, keywords: 1, clicks: 1 });
    },
    ingestState: (p: AdsPayload) => {
      got.push(p);
      calls.push("state");
      return Promise.resolve({ state_campaigns: 1, state_keywords: 1, search_terms: 1, networks: 1 });
    },
    report: (cust: string, results: CommandResult[]) => {
      calls.push(`report:${cust}:${JSON.stringify(results)}`);
      return Promise.resolve(results.length);
    },
    ingestReports: (cust: string, reports: unknown[]) => {
      calls.push(`reports:${cust}:${reports.length}`);
      got.push({ reports } as unknown as AdsPayload);
      return Promise.resolve(reports.length);
    },
    claim: (cust: string) => {
      calls.push(`claim:${cust}`);
      return Promise.resolve([{ id: 7, kind: "campaign_status", campaign_id: "111", value: { status: "PAUSED" } }]);
    },
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  const h = "header" in opts ? opts.header : SECRET;
  if (h !== null && h !== undefined) headers["x-radar-secret"] = h;
  const method = opts.method ?? "POST";
  const req = new Request("http://x/ads-sync", {
    method,
    headers,
    body: method === "POST" ? (opts.body ?? JSON.stringify(valid)) : undefined,
  });
  return { got, calls, res: handleAdsSync(req, deps) };
}

Deno.test("payload valido -> 200, ingest recebe dados limpos", async () => {
  const { got, res } = mk();
  const r = await res;
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true, campaigns: 1, keywords: 1, clicks: 1 });
  assertEquals(got.length, 1);
  const p = got[0];
  assertEquals(p.customer_id, "1234567890");
  assertEquals(p.stats?.campaigns[0], {
    day: "2026-11-10", campaign_id: "111", campaign_name: "SBC Pesquisa", channel: "SEARCH",
    impressions: 800, clicks: 40, cost_micros: 80500000, conversions: 1.5,
  });
  assertEquals(p.stats?.keywords[0].criterion_id, "7001");
  assertEquals(p.clicks?.[0].gclid, "Cj0KCQiA-abc_123");
});

Deno.test("chave errada ou ausente -> 401 sem gravar", async () => {
  for (const header of ["errada", "", null]) {
    const { got, res } = mk({ header });
    const r = await res;
    assertEquals(r.status, 401);
    assertEquals(await r.json(), { ok: false, error: "unauthorized" });
    assertEquals(got.length, 0);
  }
});

Deno.test("sem segredo configurado (ou curto demais) -> 503", async () => {
  for (const secret of [undefined, "", "curto"]) {
    const { got, res } = mk({ secret, header: secret ?? "" });
    assertEquals((await res).status, 503);
    assertEquals(got.length, 0);
  }
});

Deno.test("metodo diferente de POST -> 405", async () => {
  assertEquals((await mk({ method: "GET" }).res).status, 405);
});

Deno.test("payload invalido -> 400 dizendo onde", async () => {
  const cases: [unknown, string][] = [
    ["not json", "json"],
    [{ ...valid, customer_id: "abc" }, "customer_id"],
    [{ ...valid, stats: { ...valid.stats, date_from: "2026-11-11" } }, "stats.date_from"],
    [{ ...valid, stats: { ...valid.stats, campaigns: [{ ...campaign, day: "10/11/2026" }] } }, "stats.campaigns[0].day"],
    [{ ...valid, stats: { ...valid.stats, campaigns: [{ ...campaign, cost_micros: -1 }] } }, "stats.campaigns[0].cost_micros"],
    [{ ...valid, stats: { ...valid.stats, keywords: [{ ...keyword, criterion_id: "x" }] } }, "stats.keywords[0].criterion_id"],
    [{ ...valid, clicks: [{ ...click, gclid: "has space" }] }, "clicks[0].gclid"],
    [{ ...valid, clicks: "nope" }, "clicks"],
  ];
  for (const [body, at] of cases) {
    const { got, res } = mk({ body: typeof body === "string" ? body : JSON.stringify(body) });
    const r = await res;
    assertEquals(r.status, 400, at);
    assertEquals(await r.json(), { ok: false, error: "invalid_payload", at });
    assertEquals(got.length, 0);
  }
});

Deno.test("listas acima do limite -> 400", () => {
  let at = "";
  try {
    parsePayload({ customer_id: "1234567890", clicks: Array(LIMITS.clicks + 1).fill(click) });
  } catch (e) {
    at = (e as Error).message;
  }
  assertEquals(at, "clicks");
});

Deno.test("so cliques, sem stats -> stats ausente; chaves extras descartadas", () => {
  const p = parsePayload({ customer_id: 1234567890, clicks: [{ ...click, extra: "x", campaign_id: "" }] } as unknown);
  assertEquals(p.stats, undefined);
  assertEquals(p.customer_id, "1234567890");
  assertEquals(Object.keys(p.clicks![0]).sort(), ["ad_group_id", "campaign_id", "criterion_id", "day", "gclid", "keyword_text", "match_type"]);
  assertEquals(p.clicks![0].campaign_id, null);
});

Deno.test("corpo grande demais -> 413", async () => {
  const { res } = mk({ body: "x".repeat(8_000_001) });
  assertEquals((await res).status, 413);
});

Deno.test("falha no banco -> 500 generico", async () => {
  const { res } = mk({ fail: true });
  const r = await res;
  assertEquals(r.status, 500);
  assertEquals(await r.json(), { ok: false, error: "server_error" });
});

const state = {
  campaigns: [{ campaign_id: "111", campaign_name: "SBC", status: "ENABLED", channel: "SEARCH", bidding_strategy: "MAXIMIZE_CONVERSIONS", budget_id: "55", budget_micros: "100000000", budget_shared: false }],
  keywords: [{ campaign_id: "111", ad_group_id: "901", criterion_id: "7001", ad_group_name: "Aptos", keyword_text: "apto sbc", match_type: "PHRASE", status: "PAUSED" }],
};
const insights = {
  date_from: "2026-10-20", date_to: "2026-11-18",
  search_terms: [{ campaign_id: "111", ad_group_id: "901", search_term: " apto 3 dorms sbc ", status: "NONE", impressions: "10", clicks: "2", cost_micros: "3000000", conversions: 0 }],
  networks: [{ campaign_id: "111", network: "YOUTUBE", impressions: "100", clicks: "5", cost_micros: "9000000", conversions: 0 }],
};

Deno.test("estado e insights vao para ingestState, sem contar como sincronizacao de custo", async () => {
  const { got, calls, res } = mk({ body: JSON.stringify({ customer_id: "1234567890", state, insights }) });
  const r = await res;
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true, state_campaigns: 1, state_keywords: 1, search_terms: 1, networks: 1 });
  assertEquals(calls, ["state"]);
  assertEquals(got[0].state?.campaigns?.[0].budget_micros, 100000000);
  assertEquals(got[0].state?.keywords?.[0].status, "PAUSED");
  assertEquals(got[0].insights?.search_terms?.[0].search_term, "apto 3 dorms sbc");
  assertEquals(got[0].insights?.networks?.[0].network, "YOUTUBE");
});

Deno.test("resultados sao gravados antes de buscar novos comandos; pull devolve os comandos", async () => {
  const results = [{ id: 5, ok: true }, { id: 6, ok: false, error: "budget too low" }];
  const { calls, res } = mk({ body: JSON.stringify({ customer_id: "1234567890", results, pull: true }) });
  const r = await res;
  assertEquals(r.status, 200);
  const body = await r.json();
  assertEquals(body.reported, 2);
  assertEquals(body.commands, [{ id: 7, kind: "campaign_status", campaign_id: "111", value: { status: "PAUSED" } }]);
  assertEquals(calls, [
    'report:1234567890:[{"id":5,"ok":true,"error":null},{"id":6,"ok":false,"error":"budget too low"}]',
    "claim:1234567890",
  ]);
});

Deno.test("estado, insights e resultados invalidos -> 400 dizendo onde", async () => {
  const base = { customer_id: "1234567890" };
  const cases: [unknown, string][] = [
    [{ ...base, state: { campaigns: [{ ...state.campaigns[0], campaign_id: "x" }] } }, "state.campaigns[0].campaign_id"],
    [{ ...base, state: { campaigns: [{ ...state.campaigns[0], budget_shared: "sim" }] } }, "state.campaigns[0].budget_shared"],
    [{ ...base, state: { keywords: [{ ...state.keywords[0], criterion_id: null }] } }, "state.keywords[0].criterion_id"],
    [{ ...base, insights: { ...insights, date_from: "2026-11-19" } }, "insights.date_from"],
    [{ ...base, insights: { ...insights, search_terms: [{ ...insights.search_terms[0], search_term: "  " }] } }, "insights.search_terms[0].search_term"],
    [{ ...base, results: [{ id: "5", ok: true }] }, "results[0].id"],
    [{ ...base, results: [{ id: 5 }] }, "results[0].ok"],
    [{ ...base, pull: "yes" }, "pull"],
  ];
  for (const [body, at] of cases) {
    const { calls, res } = mk({ body: JSON.stringify(body) });
    const r = await res;
    assertEquals(r.status, 400, at);
    assertEquals(await r.json(), { ok: false, error: "invalid_payload", at });
    assertEquals(calls, []);
  }
});

Deno.test("relatorios vao para ingestReports com valores planos; nome desconhecido ou objeto aninhado -> 400", async () => {
  const reports = [
    { report: "locations_city", date_from: "2026-08-22", date_to: "2026-11-19", rows: [{ campaign_id: "111", location: "geoTargetConstants/1001773", location_name: "Sao Bernardo do Campo", targeted: true, clicks: "40", cost_micros: "9000000", conversions: 1.5 }] },
    { report: "conversion_actions", rows: [], error: "query falhou" },
  ];
  const { got, calls, res } = mk({ body: JSON.stringify({ customer_id: "1234567890", reports }) });
  const r = await res;
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true, reports: 2 });
  assertEquals(calls, ["reports:1234567890:2"]);
  const sent = (got[0] as unknown as { reports: { rows: unknown[]; error: string | null; date_from: string | null }[] }).reports;
  assertEquals(sent[0].rows[0], reports[0].rows[0]);
  assertEquals(sent[1].error, "query falhou");
  assertEquals(sent[1].date_from, null);

  const bad: [unknown, string][] = [
    [[{ report: "outra", rows: [] }], "reports[0].report"],
    [[{ report: "locations_city", rows: [{ a: { b: 1 } }] }], "reports[0].rows[0].a"],
    [[{ report: "locations_city", rows: [{ "Bad-Key": 1 }] }], "reports[0].rows[0].Bad-Key"],
  ];
  for (const [rs, at] of bad) {
    const t = mk({ body: JSON.stringify({ customer_id: "1234567890", reports: rs }) });
    const rr = await t.res;
    assertEquals(rr.status, 400, at);
    assertEquals(await rr.json(), { ok: false, error: "invalid_payload", at });
  }
});
