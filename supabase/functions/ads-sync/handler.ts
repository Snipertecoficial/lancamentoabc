// Receives Google Ads cost data from the Google Ads script (server to server, no browser, no CORS).
// Auth: header x-radar-secret must equal RADAR_ADS_SECRET. The payload is validated and rebuilt
// with known keys only, then handed to ads_ingest (costs/clicks), ads_state_ingest (state/insights),
// ads_commands_report (results of applied edits) and ads_commands_claim (pull: edits to apply).
import { sha256Hex } from "../_shared/hash.ts";

export const MAX_BODY = 8_000_000;
export const LIMITS = {
  campaigns: 20_000, keywords: 50_000, clicks: 5_000,
  state_campaigns: 2_000, state_keywords: 20_000, search_terms: 20_000, networks: 5_000, results: 200,
} as const;

export type CampaignRow = {
  day: string; campaign_id: string; campaign_name: string | null; channel: string | null;
  impressions: number; clicks: number; cost_micros: number; conversions: number;
};
export type KeywordRow = {
  day: string; campaign_id: string; ad_group_id: string; criterion_id: string; ad_group_name: string | null;
  keyword_text: string | null; match_type: string | null;
  impressions: number; clicks: number; cost_micros: number; conversions: number;
};
export type ClickRow = {
  gclid: string; day: string; campaign_id: string | null; ad_group_id: string | null;
  criterion_id: string | null; keyword_text: string | null; match_type: string | null;
};
// Current state of the account (replaces the snapshot) and 30-day insights, for the panel and analysis.
export type StateCampaign = {
  campaign_id: string; campaign_name: string | null; status: string | null; channel: string | null;
  bidding_strategy: string | null; budget_id: string | null; budget_micros: number | null; budget_shared: boolean;
};
export type StateKeyword = {
  campaign_id: string; ad_group_id: string; criterion_id: string; ad_group_name: string | null;
  keyword_text: string | null; match_type: string | null; status: string | null;
};
export type SearchTermRow = {
  campaign_id: string; ad_group_id: string; search_term: string; status: string | null;
  impressions: number; clicks: number; cost_micros: number; conversions: number;
};
export type NetworkRow = {
  campaign_id: string; network: string; impressions: number; clicks: number; cost_micros: number; conversions: number;
};
// Outcome of a command the script was handed (ads_commands_claim).
export type CommandResult = { id: number; ok: boolean; error: string | null };

export type AdsPayload = {
  customer_id: string;
  currency: string | null;
  time_zone: string | null;
  stats?: { date_from: string; date_to: string; campaigns: CampaignRow[]; keywords: KeywordRow[] };
  clicks?: ClickRow[];
  state?: { campaigns?: StateCampaign[]; keywords?: StateKeyword[] };
  insights?: { date_from: string; date_to: string; search_terms?: SearchTermRow[]; networks?: NetworkRow[] };
  results?: CommandResult[];
  pull?: boolean;
};

export type AdsSyncDeps = {
  secret: string | undefined;
  ingest(p: AdsPayload): Promise<Record<string, number>>;
  ingestState(p: AdsPayload): Promise<Record<string, number>>;
  report(customerId: string, results: CommandResult[]): Promise<number>;
  claim(customerId: string): Promise<unknown[]>;
};

class Invalid extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^\d{1,20}$/;
const GCLID_RE = /^[A-Za-z0-9_\-]{1,200}$/;

function day(v: unknown, at: string): string {
  if (typeof v !== "string" || !DAY_RE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Invalid(at);
  return v;
}
function id(v: unknown, at: string): string {
  const s = typeof v === "number" && Number.isSafeInteger(v) ? String(v) : v;
  if (typeof s !== "string" || !ID_RE.test(s)) throw new Invalid(at);
  return s;
}
function optId(v: unknown, at: string): string | null {
  return v === null || v === undefined || v === "" ? null : id(v, at);
}
function text(v: unknown, max: number, at: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Invalid(at);
  const t = v.trim().slice(0, max);
  return t || null;
}
// Google sends int64 metrics as strings; accept both, never negative.
function count(v: unknown, at: string): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (n === undefined || n === null) return 0;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Invalid(at);
  return n;
}
function decimal(v: unknown, at: string): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (n === undefined || n === null) return 0;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new Invalid(at);
  return n;
}
function list(v: unknown, max: number, at: string): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max) throw new Invalid(at);
  return v;
}
function obj(v: unknown, at: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Invalid(at);
  return v as Record<string, unknown>;
}

export function parsePayload(raw: unknown): AdsPayload {
  const b = obj(raw, "body");
  const rawCustomer = typeof b.customer_id === "number" && Number.isSafeInteger(b.customer_id) ? String(b.customer_id) : b.customer_id;
  const customer = typeof rawCustomer === "string" ? rawCustomer.replace(/-/g, "") : rawCustomer;
  if (typeof customer !== "string" || !/^\d{6,12}$/.test(customer)) throw new Invalid("customer_id");
  const out: AdsPayload = {
    customer_id: customer,
    currency: text(b.currency, 8, "currency"),
    time_zone: text(b.time_zone, 64, "time_zone"),
  };

  if (b.stats !== undefined && b.stats !== null) {
    const s = obj(b.stats, "stats");
    const from = day(s.date_from, "stats.date_from");
    const to = day(s.date_to, "stats.date_to");
    if (from > to) throw new Invalid("stats.date_from");
    out.stats = {
      date_from: from,
      date_to: to,
      campaigns: list(s.campaigns, LIMITS.campaigns, "stats.campaigns").map((r, i) => {
        const at = `stats.campaigns[${i}]`;
        const o = obj(r, at);
        return {
          day: day(o.day, `${at}.day`),
          campaign_id: id(o.campaign_id, `${at}.campaign_id`),
          campaign_name: text(o.campaign_name, 255, `${at}.campaign_name`),
          channel: text(o.channel, 64, `${at}.channel`),
          impressions: count(o.impressions, `${at}.impressions`),
          clicks: count(o.clicks, `${at}.clicks`),
          cost_micros: count(o.cost_micros, `${at}.cost_micros`),
          conversions: decimal(o.conversions, `${at}.conversions`),
        };
      }),
      keywords: list(s.keywords, LIMITS.keywords, "stats.keywords").map((r, i) => {
        const at = `stats.keywords[${i}]`;
        const o = obj(r, at);
        return {
          day: day(o.day, `${at}.day`),
          campaign_id: id(o.campaign_id, `${at}.campaign_id`),
          ad_group_id: id(o.ad_group_id, `${at}.ad_group_id`),
          criterion_id: id(o.criterion_id, `${at}.criterion_id`),
          ad_group_name: text(o.ad_group_name, 255, `${at}.ad_group_name`),
          keyword_text: text(o.keyword_text, 255, `${at}.keyword_text`),
          match_type: text(o.match_type, 32, `${at}.match_type`),
          impressions: count(o.impressions, `${at}.impressions`),
          clicks: count(o.clicks, `${at}.clicks`),
          cost_micros: count(o.cost_micros, `${at}.cost_micros`),
          conversions: decimal(o.conversions, `${at}.conversions`),
        };
      }),
    };
  }

  if (b.state !== undefined && b.state !== null) {
    const st = obj(b.state, "state");
    out.state = {};
    if (st.campaigns !== undefined && st.campaigns !== null) {
      out.state.campaigns = list(st.campaigns, LIMITS.state_campaigns, "state.campaigns").map((r, i) => {
        const at = `state.campaigns[${i}]`;
        const o = obj(r, at);
        if (o.budget_shared !== undefined && o.budget_shared !== null && typeof o.budget_shared !== "boolean") {
          throw new Invalid(`${at}.budget_shared`);
        }
        return {
          campaign_id: id(o.campaign_id, `${at}.campaign_id`),
          campaign_name: text(o.campaign_name, 255, `${at}.campaign_name`),
          status: text(o.status, 32, `${at}.status`),
          channel: text(o.channel, 64, `${at}.channel`),
          bidding_strategy: text(o.bidding_strategy, 64, `${at}.bidding_strategy`),
          budget_id: optId(o.budget_id, `${at}.budget_id`),
          budget_micros: o.budget_micros === null || o.budget_micros === undefined ? null : count(o.budget_micros, `${at}.budget_micros`),
          budget_shared: o.budget_shared === true,
        };
      });
    }
    if (st.keywords !== undefined && st.keywords !== null) {
      out.state.keywords = list(st.keywords, LIMITS.state_keywords, "state.keywords").map((r, i) => {
        const at = `state.keywords[${i}]`;
        const o = obj(r, at);
        return {
          campaign_id: id(o.campaign_id, `${at}.campaign_id`),
          ad_group_id: id(o.ad_group_id, `${at}.ad_group_id`),
          criterion_id: id(o.criterion_id, `${at}.criterion_id`),
          ad_group_name: text(o.ad_group_name, 255, `${at}.ad_group_name`),
          keyword_text: text(o.keyword_text, 255, `${at}.keyword_text`),
          match_type: text(o.match_type, 32, `${at}.match_type`),
          status: text(o.status, 32, `${at}.status`),
        };
      });
    }
  }

  if (b.insights !== undefined && b.insights !== null) {
    const s = obj(b.insights, "insights");
    const from = day(s.date_from, "insights.date_from");
    const to = day(s.date_to, "insights.date_to");
    if (from > to) throw new Invalid("insights.date_from");
    out.insights = { date_from: from, date_to: to };
    if (s.search_terms !== undefined && s.search_terms !== null) {
      out.insights.search_terms = list(s.search_terms, LIMITS.search_terms, "insights.search_terms").map((r, i) => {
        const at = `insights.search_terms[${i}]`;
        const o = obj(r, at);
        const term = text(o.search_term, 255, `${at}.search_term`);
        if (!term) throw new Invalid(`${at}.search_term`);
        return {
          campaign_id: id(o.campaign_id, `${at}.campaign_id`),
          ad_group_id: id(o.ad_group_id, `${at}.ad_group_id`),
          search_term: term,
          status: text(o.status, 32, `${at}.status`),
          impressions: count(o.impressions, `${at}.impressions`),
          clicks: count(o.clicks, `${at}.clicks`),
          cost_micros: count(o.cost_micros, `${at}.cost_micros`),
          conversions: decimal(o.conversions, `${at}.conversions`),
        };
      });
    }
    if (s.networks !== undefined && s.networks !== null) {
      out.insights.networks = list(s.networks, LIMITS.networks, "insights.networks").map((r, i) => {
        const at = `insights.networks[${i}]`;
        const o = obj(r, at);
        const network = text(o.network, 32, `${at}.network`);
        if (!network) throw new Invalid(`${at}.network`);
        return {
          campaign_id: id(o.campaign_id, `${at}.campaign_id`),
          network,
          impressions: count(o.impressions, `${at}.impressions`),
          clicks: count(o.clicks, `${at}.clicks`),
          cost_micros: count(o.cost_micros, `${at}.cost_micros`),
          conversions: decimal(o.conversions, `${at}.conversions`),
        };
      });
    }
  }

  if (b.results !== undefined && b.results !== null) {
    out.results = list(b.results, LIMITS.results, "results").map((r, i) => {
      const at = `results[${i}]`;
      const o = obj(r, at);
      if (typeof o.id !== "number" || !Number.isSafeInteger(o.id) || o.id <= 0) throw new Invalid(`${at}.id`);
      if (typeof o.ok !== "boolean") throw new Invalid(`${at}.ok`);
      return { id: o.id, ok: o.ok, error: o.ok ? null : text(o.error, 500, `${at}.error`) };
    });
  }

  if (b.pull !== undefined && b.pull !== null) {
    if (typeof b.pull !== "boolean") throw new Invalid("pull");
    if (b.pull) out.pull = true;
  }

  if (b.clicks !== undefined && b.clicks !== null) {
    out.clicks = list(b.clicks, LIMITS.clicks, "clicks").map((r, i) => {
      const at = `clicks[${i}]`;
      const o = obj(r, at);
      if (typeof o.gclid !== "string" || !GCLID_RE.test(o.gclid)) throw new Invalid(`${at}.gclid`);
      return {
        gclid: o.gclid,
        day: day(o.day, `${at}.day`),
        campaign_id: optId(o.campaign_id, `${at}.campaign_id`),
        ad_group_id: optId(o.ad_group_id, `${at}.ad_group_id`),
        criterion_id: optId(o.criterion_id, `${at}.criterion_id`),
        keyword_text: text(o.keyword_text, 255, `${at}.keyword_text`),
        match_type: text(o.match_type, 32, `${at}.match_type`),
      };
    });
  }
  return out;
}

// Compares digests so the time taken does not depend on how much of the secret matched.
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handleAdsSync(req: Request, deps: AdsSyncDeps): Promise<Response> {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const secret = (deps.secret ?? "").trim();
  if (secret.length < 16) return json(503, { ok: false, error: "not_configured" });
  if (!(await sameSecret(req.headers.get("x-radar-secret") ?? "", secret))) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return json(413, { ok: false, error: "too_large" });
  const body = await req.text();
  if (body.length > MAX_BODY) return json(413, { ok: false, error: "too_large" });

  let payload: AdsPayload;
  try {
    payload = parsePayload(JSON.parse(body));
  } catch (err) {
    return json(400, { ok: false, error: "invalid_payload", at: err instanceof Invalid ? err.message : "json" });
  }

  try {
    // Results first: a command just applied must not be handed out again by the claim below.
    const out: Record<string, unknown> = { ok: true };
    if (payload.results?.length) out.reported = await deps.report(payload.customer_id, payload.results);
    // Only cost/click syncs count as a sync run (the panel's "atualizado há").
    if (payload.stats || payload.clicks) Object.assign(out, await deps.ingest(payload));
    if (payload.state || payload.insights) Object.assign(out, await deps.ingestState(payload));
    if (payload.pull) out.commands = await deps.claim(payload.customer_id);
    return json(200, out);
  } catch (err) {
    console.error("ads-sync ingest failed", err);
    return json(500, { ok: false, error: "server_error" });
  }
}
