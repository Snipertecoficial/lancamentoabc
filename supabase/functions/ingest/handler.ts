import type { Batch, RadarEvent } from "../_shared/envelope.ts";
import { parseBatch } from "../_shared/envelope.ts";
import { normalizePhoneBR } from "../_shared/phone.ts";
import { sha256Hex } from "../_shared/hash.ts";
import { isBot } from "../_shared/bot.ts";
import { corsHeaders } from "../_shared/cors.ts";

export type IngestDeps = {
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
  markWhatsapp(token: string): Promise<void>;
  allowedOrigins: string[];
  ipSalt: string;
};

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export async function handleIngest(req: Request, deps: IngestDeps): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin"), deps.allowedOrigins);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });

  const now = new Date();
  const parsed = parseBatch(await req.text(), now);
  if (!parsed.ok) {
    const headers = new Headers(cors);
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers });
  }
  const { batch } = parsed;

  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ipHash = await sha256Hex(ip + deps.ipSalt + now.toISOString().slice(0, 10));
    const userAgent = req.headers.get("user-agent");
    await deps.upsertSession(batch, ipHash, isBot(userAgent), userAgent);
    if (batch.visitor_id) await deps.upsertVisitor(batch);

    const leads: Parameters<IngestDeps["recordLead"]>[0][] = [];
    const tokens: string[] = [];
    const events = batch.events.map((e) => {
      if (e.type === "lead_submitted") {
        const p = e.props ?? {};
        const phone_raw = str(p.phone);
        const lead_token = str(p.lead_token) ?? crypto.randomUUID();
        leads.push({
          env: batch.env,
          phone_e164: normalizePhoneBR(phone_raw),
          phone_raw,
          name: str(p.name),
          email: str(p.email),
          session_id: batch.session_id,
          visitor_id: batch.visitor_id,
          lead_token,
        });
        // PII nunca vai para events.props
        const { name: _n, phone: _p, email: _e, ...safe } = p;
        return { ...e, props: { ...safe, lead_token } };
      }
      if (e.type === "whatsapp_click") {
        const t = str(e.props?.lead_token);
        if (t) tokens.push(t);
      }
      return e;
    });

    if (events.length > 0) await deps.insertEvents(batch, events);
    for (const lead of leads) await deps.recordLead(lead);
    for (const t of tokens) await deps.markWhatsapp(t);
  } catch (err) {
    console.error("ingest failed", err);
  }
  return new Response(null, { status: 204, headers: cors });
}
