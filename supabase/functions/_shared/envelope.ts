export const EVENT_TYPES = [
  "page_view", "scroll_depth", "section_view", "cta_click", "whatsapp_click", "rage_click",
  "video", "faq_open", "slider_view", "form_view", "form_start", "form_field_complete",
  "form_abandon", "form_submit_attempt", "lead_submitted", "thank_you_view", "consent",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const SESSION_KEYS = [
  "landing_url", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "gbraid", "wbraid", "fbclid", "keyword", "matchtype", "campaign_id", "adgroup_id",
  "device", "screen", "lang",
] as const;
export type SessionMeta = { [K in (typeof SESSION_KEYS)[number]]?: string };

export type RadarEvent = {
  id: string;
  type: EventType;
  name?: string;
  section?: string;
  ts: string;
  props?: Record<string, unknown>;
};
export type Batch = {
  v: 1;
  env: "staging" | "production";
  session_id: string;
  visitor_id: string | null;
  session: SessionMeta;
  events: RadarEvent[];
};

const MAX_BYTES = 65536;
const MAX_EVENTS = 50;
const MAX_FUTURE_MS = 24 * 3600_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set<string>(EVENT_TYPES);

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

export function parseBatch(
  raw: string,
  now: Date,
): { ok: true; batch: Batch; dropped: number } | { ok: false; error: string } {
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return { ok: false, error: "payload too large" };
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid json" };
  }
  if (!isObj(j)) return { ok: false, error: "invalid body" };
  if (j.v !== 1) return { ok: false, error: "unsupported version" };
  if (j.env !== "staging" && j.env !== "production") return { ok: false, error: "invalid env" };
  if (typeof j.session_id !== "string" || !UUID_RE.test(j.session_id)) {
    return { ok: false, error: "invalid session_id" };
  }
  const vid = j.visitor_id ?? null;
  if (vid !== null && (typeof vid !== "string" || !UUID_RE.test(vid))) {
    return { ok: false, error: "invalid visitor_id" };
  }
  if (!Array.isArray(j.events)) return { ok: false, error: "invalid events" };
  if (j.events.length > MAX_EVENTS) return { ok: false, error: "too many events" };

  const session: SessionMeta = {};
  if (isObj(j.session)) {
    for (const k of SESSION_KEYS) {
      const v = j.session[k];
      if (typeof v === "string") session[k] = v;
    }
  }

  const limit = now.getTime() + MAX_FUTURE_MS;
  const events: RadarEvent[] = [];
  let dropped = 0;
  for (const e of j.events) {
    const t = isObj(e) && typeof e.ts === "string" ? Date.parse(e.ts) : NaN;
    if (
      !isObj(e) || typeof e.type !== "string" || !TYPES.has(e.type) ||
      typeof e.id !== "string" || !UUID_RE.test(e.id) || Number.isNaN(t) || t > limit
    ) {
      dropped++;
      continue;
    }
    events.push({
      id: e.id,
      type: e.type as EventType,
      name: typeof e.name === "string" ? e.name : undefined,
      section: typeof e.section === "string" ? e.section : undefined,
      ts: e.ts as string,
      props: isObj(e.props) ? e.props : undefined,
    });
  }
  return {
    ok: true,
    dropped,
    batch: {
      v: 1,
      env: j.env,
      session_id: j.session_id,
      visitor_id: vid as string | null,
      session,
      events,
    },
  };
}
