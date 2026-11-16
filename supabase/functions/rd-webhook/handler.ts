import { sha256Hex } from "../_shared/hash.ts";
import { normalizePhoneBR } from "../_shared/phone.ts";
import { parseRdPayload } from "./parse.ts";

export type RdConfirmLead = {
  name: string | null;
  email: string | null;
  phone_e164: string | null;
  rd_lead_id: string | null;
};

export type RdWebhookDeps = {
  secret: string;
  storeRaw(payload: unknown): Promise<number>;
  confirm(lead: RdConfirmLead): Promise<string>;
  finish(rawId: number, ids: string[], error: string | null): Promise<void>;
};

async function secretMatches(given: string | null, expected: string): Promise<boolean> {
  if (!expected || given === null) return false;
  // compara os hashes (tamanho fixo) com acumulação XOR: tempo constante
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function handleRdWebhook(req: Request, deps: RdWebhookDeps): Promise<Response> {
  const ok = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  if (req.method !== "POST") return new Response(null, { status: 405 });

  let given: string | null = null;
  try {
    given = new URL(req.url).searchParams.get("secret");
  } catch { /* url inválida -> 401 */ }
  if (!(await secretMatches(given, deps.secret))) return new Response(null, { status: 401 });

  let text = "";
  try {
    text = await req.text();
  } catch { /* corpo ilegível tratado como JSON inválido */ }

  let payload: unknown;
  let parseError: string | null = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { _raw: text };
    parseError = "invalid_json";
  }

  let rawId: number;
  try {
    rawId = await deps.storeRaw(payload);
  } catch (err) {
    console.error("rd-webhook storeRaw failed", err);
    return ok();
  }

  const ids: string[] = [];
  const errors: string[] = parseError ? [parseError] : [];
  for (const lead of parseRdPayload(payload)) {
    if (!lead.phone_raw && !lead.email) continue;
    try {
      ids.push(await deps.confirm({
        name: lead.name,
        email: lead.email,
        phone_e164: normalizePhoneBR(lead.phone_raw),
        rd_lead_id: lead.rd_lead_id,
      }));
    } catch (err) {
      errors.push(msg(err));
    }
  }

  try {
    await deps.finish(rawId, ids, errors.length ? errors.join("; ") : null);
  } catch (err) {
    console.error("rd-webhook finish failed", err);
  }
  return ok();
}
