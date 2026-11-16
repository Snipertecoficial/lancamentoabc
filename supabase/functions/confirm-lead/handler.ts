import { sha256Hex } from "../_shared/hash.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { UUID_RE } from "../_shared/uuid.ts";

export type ConfirmLeadDeps = {
  consume(token: string): Promise<
    { first_use: boolean; phone_e164: string | null; email: string | null } | null
  >;
  allowedOrigins: string[];
};

export async function handleConfirmLead(req: Request, deps: ConfirmLeadDeps): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin"), deps.allowedOrigins);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const headers = new Headers(cors);
  headers.set("content-type", "application/json");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method !== "POST") return json(405, { ok: false });

  let token: unknown;
  try {
    token = JSON.parse(await req.text())?.lead_token;
  } catch {
    return json(400, { ok: false });
  }
  if (typeof token !== "string" || !UUID_RE.test(token)) return json(400, { ok: false });

  let row: Awaited<ReturnType<ConfirmLeadDeps["consume"]>>;
  try {
    row = await deps.consume(token);
  } catch (err) {
    console.error("confirm-lead consume failed", err);
    return json(500, { ok: false });
  }
  if (!row) return json(404, { ok: false });
  if (!row.first_use) return json(200, { ok: true, first_use: false, user_data: null });

  return json(200, {
    ok: true,
    first_use: true,
    user_data: {
      sha256_phone_number: row.phone_e164 ? await sha256Hex(row.phone_e164) : null,
      sha256_email_address: row.email ? await sha256Hex(row.email.trim().toLowerCase()) : null,
    },
  });
}
