import type { Batch, RadarEvent } from "../_shared/envelope.ts";
import { UUID_RE } from "../_shared/uuid.ts";
import { normalizePhoneBR } from "../_shared/phone.ts";
import { ipHashOf } from "../_shared/ip.ts";
import { isBot } from "../_shared/bot.ts";
import { corsHeaders } from "../_shared/cors.ts";

export type SubmitLeadDeps = {
  upsertSession(b: Batch, ipHash: string, isBot: boolean, userAgent: string | null): Promise<void>;
  upsertVisitor(b: Batch): Promise<void>;
  insertEvents(b: Batch, events: RadarEvent[]): Promise<void>;
  recordLead(args: {
    env: string;
    phone_e164: string | null;
    phone_raw: string | null;
    name: string | null;
    email: string | null;
    session_id: string;
    visitor_id: string | null;
    lead_token: string;
  }): Promise<string>;
  countRecentLeadSubmissions(ipHash: string): Promise<number>;
  allowedOrigins: string[];
  ipSalt: string;
};

const MAX_PER_HOUR = 5;
const MIN_ELAPSED_MS = 2000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PHONE_CHARS = 40;
const FORM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleSubmitLead(req: Request, deps: SubmitLeadDeps): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin"), deps.allowedOrigins);
  const reply = (status: number, body: unknown) => {
    const headers = new Headers(cors);
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(body), { status, headers });
  };
  const fail = (status: number, error: string) => reply(status, { ok: false, error });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });

  let p: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail(400, "invalid_request");
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "invalid_request");
    p = parsed as Record<string, unknown>;
  } catch {
    return fail(400, "invalid_request");
  }

  const env = p.env;
  const sessionId = p.session_id;
  const visitorId = p.visitor_id ?? null;
  if (env !== "staging" && env !== "production") return fail(400, "invalid_request");
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) return fail(400, "invalid_request");
  if (visitorId !== null && (typeof visitorId !== "string" || !UUID_RE.test(visitorId))) {
    return fail(400, "invalid_request");
  }
  if (typeof p.form_id !== "string" || !FORM_ID_RE.test(p.form_id)) return fail(400, "invalid_request");

  // Bot: resposta idêntica à de sucesso, sem gravar nada e sem revelar o filtro.
  const hp = p.hp;
  const elapsed = p.elapsed_ms;
  if ((typeof hp === "string" && hp !== "") || (hp != null && typeof hp !== "string") ||
    typeof elapsed !== "number" || !(elapsed >= MIN_ELAPSED_MS)) {
    return reply(200, { ok: true, lead_token: crypto.randomUUID() });
  }

  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (name.length < 2 || name.length > 80) return fail(400, "invalid_name");
  const phoneRaw = typeof p.phone === "string" ? p.phone : null;
  const phoneE164 = phoneRaw !== null && phoneRaw.length <= MAX_PHONE_CHARS ? normalizePhoneBR(phoneRaw) : null;
  if (!phoneE164) return fail(400, "invalid_phone");
  let email: string | null = null;
  if (p.email !== undefined && p.email !== null && p.email !== "") {
    if (typeof p.email !== "string" || p.email.trim().length > 254 || !EMAIL_RE.test(p.email.trim())) {
      return fail(400, "invalid_email");
    }
    email = p.email.trim();
  }
  const intent = p.intent === "morar" || p.intent === "investir" ? p.intent : null;

  try {
    const now = new Date();
    const ipHash = await ipHashOf(req, deps.ipSalt, now);
    if (await deps.countRecentLeadSubmissions(ipHash) >= MAX_PER_HOUR) return fail(429, "rate_limited");

    const leadToken = crypto.randomUUID();
    const ua = req.headers.get("user-agent");
    const event: RadarEvent = {
      id: crypto.randomUUID(),
      type: "lead_submitted",
      ts: now.toISOString(),
      props: { form_id: p.form_id, ...(intent ? { intent } : {}), lead_token: leadToken, ip_hash: ipHash },
    };
    const batch: Batch = { v: 1, env, session_id: sessionId, visitor_id: visitorId, session: {}, events: [event] };

    // visitors antes de sessions (FK sessions.visitor_id -> visitors); evento antes do lead (autolink).
    if (visitorId) await deps.upsertVisitor(batch);
    await deps.upsertSession(batch, ipHash, isBot(ua), ua);
    await deps.insertEvents(batch, [event]);
    await deps.recordLead({
      env,
      phone_e164: phoneE164,
      phone_raw: phoneRaw,
      name,
      email,
      session_id: sessionId,
      visitor_id: visitorId,
      lead_token: leadToken,
    });
    return reply(200, { ok: true, lead_token: leadToken });
  } catch {
    console.error("submit-lead failed"); // sem err.message: pode conter PII (detalhes de constraint)
    return fail(500, "server");
  }
}
