// Runs the Google Ads script against fake AdsApp / UrlFetchApp / Utilities objects.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert";

const src = await Deno.readTextFile(new URL("./radar-ads-sync.js", import.meta.url));

type Row = Record<string, unknown>;
type Post = { url: string; opts: { headers: Record<string, string>; payload: string } };

function load(rowsFor: (q: string) => Row[], reply: (n: number) => [number, string] = () => [200, '{"ok":true,"campaigns":1,"keywords":1,"clicks":1}']) {
  const queries: string[] = [];
  const posts: Post[] = [];
  const logs: string[] = [];
  const AdsApp = {
    currentAccount: () => ({ getTimeZone: () => "America/Sao_Paulo", getCustomerId: () => "123-456-7890", getCurrencyCode: () => "BRL" }),
    search(q: string) {
      queries.push(q);
      const rows = rowsFor(q);
      let i = 0;
      return { hasNext: () => i < rows.length, next: () => rows[i++] };
    },
  };
  const UrlFetchApp = {
    fetch(url: string, opts: Post["opts"]) {
      posts.push({ url, opts });
      const [code, text] = reply(posts.length);
      return { getResponseCode: () => code, getContentText: () => text };
    },
  };
  const Utilities = { formatDate: () => "2026-11-17" };
  const Logger = { log: (s: string) => logs.push(s) };
  const api = new Function("AdsApp", "UrlFetchApp", "Utilities", "Logger",
    `${src}\nreturn { main, RADAR, radarAddDays_, radarCriterionId_ };`)(AdsApp, UrlFetchApp, Utilities, Logger);
  return { api, queries, posts, logs };
}

const campaignRow = { segments: { date: "2026-11-16" }, campaign: { id: "111", name: "SBC Pesquisa", advertisingChannelType: "SEARCH" }, metrics: { impressions: "800", clicks: "40", costMicros: "80500000", conversions: 1 } };
const keywordRow = { segments: { date: "2026-11-16" }, campaign: { id: "111" }, adGroup: { id: "901", name: "Apartamentos" }, adGroupCriterion: { criterionId: "7001", keyword: { text: "apartamento sbc", matchType: "PHRASE" } }, metrics: { impressions: "600" } };
const clickRow = (gclid: string) => ({ clickView: { gclid, keyword: "customers/1234567890/adGroupCriteria/901~7001", keywordInfo: { text: "apartamento sbc", matchType: "PHRASE" } }, segments: { date: "2026-11-17" }, campaign: { id: "111" }, adGroup: { id: "901" } });

function rowsFor(q: string): Row[] {
  if (q.includes("FROM campaign")) return [campaignRow];
  if (q.includes("FROM keyword_view")) return [keywordRow];
  if (q.includes("FROM click_view") && q.includes("'2026-11-17'")) return [clickRow("g1"), clickRow("g2"), clickRow("g3"), { clickView: {} }];
  return [];
}

Deno.test("sem chave configurada o script para com mensagem clara e nao envia nada", () => {
  const { api, posts } = load(rowsFor);
  assertThrows(() => api.main(), Error, "cole a chave");
  assertEquals(posts.length, 0);
});

Deno.test("envia custos de 90 dias e cliques de 30 dias, com a chave no cabecalho", () => {
  const { api, queries, posts, logs } = load(rowsFor);
  api.RADAR.SECRET = "chave-de-teste-1234567890";
  api.main();

  assert(queries[0].includes("FROM campaign WHERE segments.date BETWEEN '2026-08-20' AND '2026-11-17'"));
  assert(queries[1].includes("FROM keyword_view WHERE segments.date BETWEEN '2026-08-20' AND '2026-11-17'"));
  const clickDays = queries.filter((q) => q.includes("FROM click_view")).map((q) => /'(\d{4}-\d{2}-\d{2})'/.exec(q)![1]);
  assertEquals(clickDays.length, 30);
  assertEquals([clickDays[0], clickDays[1], clickDays[29]], ["2026-11-17", "2026-11-16", "2026-10-19"]);

  assertEquals(posts.length, 2);
  assertEquals(posts[0].url, "https://cnsmmwbqfbaimwexmtkx.supabase.co/functions/v1/ads-sync");
  assertEquals(posts[0].opts.headers["x-radar-secret"], "chave-de-teste-1234567890");
  const first = JSON.parse(posts[0].opts.payload);
  assertEquals(first.customer_id, "1234567890");
  assertEquals(first.currency, "BRL");
  assertEquals(first.stats.date_from, "2026-08-20");
  assertEquals(first.stats.campaigns, [{ day: "2026-11-16", campaign_id: "111", campaign_name: "SBC Pesquisa", channel: "SEARCH", impressions: "800", clicks: "40", cost_micros: "80500000", conversions: 1 }]);
  assertEquals(first.stats.keywords[0].criterion_id, "7001");
  assertEquals(first.stats.keywords[0].clicks, 0);
  assertEquals(first.clicks, undefined);

  const second = JSON.parse(posts[1].opts.payload);
  assertEquals(second.stats, undefined);
  assertEquals(second.clicks.map((c: { gclid: string }) => c.gclid), ["g1", "g2", "g3"]);
  assertEquals(second.clicks[0], { gclid: "g1", day: "2026-11-17", campaign_id: "111", ad_group_id: "901", criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE" });
  assert(logs.some((l) => l.startsWith("Radar: ok.")));
});

Deno.test("cliques vao em lotes", () => {
  const { api, posts } = load(rowsFor);
  api.RADAR.SECRET = "chave-de-teste-1234567890";
  api.RADAR.CLICK_BATCH = 2;
  api.main();
  assertEquals(posts.map((p) => JSON.parse(p.opts.payload).clicks?.length ?? "stats"), ["stats", 2, 1]);
});

Deno.test("resposta diferente de 200 vira erro visivel no Google Ads", () => {
  const { api, posts } = load(rowsFor, () => [401, '{"ok":false,"error":"unauthorized"}']);
  api.RADAR.SECRET = "chave-errada-1234567890";
  assertThrows(() => api.main(), Error, "Radar respondeu 401");
  assertEquals(posts.length, 1);
});

Deno.test("helpers de data e id do criterio", () => {
  const { api } = load(rowsFor);
  assertEquals(api.radarAddDays_("2026-03-01", -1), "2026-02-28");
  assertEquals(api.radarAddDays_("2026-12-31", 1), "2027-01-01");
  assertEquals(api.radarCriterionId_("customers/1/adGroupCriteria/2~345"), "345");
  assertEquals(api.radarCriterionId_(null), null);
});
