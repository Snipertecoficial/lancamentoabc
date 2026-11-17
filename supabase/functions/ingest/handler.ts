import type { Batch, RadarEvent } from "../_shared/envelope.ts";
import { parseBatch } from "../_shared/envelope.ts";
import { ipHashOf } from "../_shared/ip.ts";
import { isBot } from "../_shared/bot.ts";
import { corsHeaders } from "../_shared/cors.ts";

export type IngestDeps = {
  upsertSession(b: Batch, ipHash: string, isBot: boolean, userAgent: string | null): Promise<void>;
  upsertVisitor(b: Batch): Promise<void>;
  insertEvents(b: Batch, events: RadarEvent[]): Promise<void>;
  markWhatsapp(token: string): Promise<void>;
  allowedOrigins: string[];
  ipSalt: string;
};

const PII_KEYS = new Set([
  "name", "nome", "phone", "telefone", "celular", "mobile_phone", "phone_raw", "email", "e-mail",
]);

function scrubPii(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([k]) => !PII_KEYS.has(k.toLowerCase())));
}

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

  // Só o submit-lead cria leads (com anti-bot e rate limit): lead_submitted vindo do ingest é descartado.
  const tokens: string[] = [];
  const events = batch.events.filter((e) => e.type !== "lead_submitted").map((e) => {
    if (e.type === "whatsapp_click") {
      const t = str(e.props?.lead_token);
      if (t) tokens.push(t);
    }
    return e.props ? { ...e, props: scrubPii(e.props) } : e;
  });

  // Cada etapa é isolada: uma falha é logada e as demais continuam.
  const stage = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      console.error(`ingest ${label} failed`, err);
    }
  };

  let ipHash = "";
  const ua = req.headers.get("user-agent");
  await stage("hash", async () => {
    ipHash = await ipHashOf(req, deps.ipSalt, now);
  });
  // visitors antes de sessions (FK sessions.visitor_id -> visitors)
  if (batch.visitor_id) await stage("upsertVisitor", () => deps.upsertVisitor(batch));
  await stage("upsertSession", () => deps.upsertSession(batch, ipHash, isBot(ua), ua));
  if (events.length > 0) await stage("insertEvents", () => deps.insertEvents(batch, events));
  for (const t of tokens) await stage("markWhatsapp", () => deps.markWhatsapp(t));
  return new Response(null, { status: 204, headers: cors });
}
