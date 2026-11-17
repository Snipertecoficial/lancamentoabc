import { sha256Hex } from "./hash.ts";

/** sha256(primeiro IP de x-forwarded-for + salt + data UTC). Mesma derivação para ingest e submit-lead. */
export async function ipHashOf(req: Request, salt: string, now: Date): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return await sha256Hex(ip + salt + now.toISOString().slice(0, 10));
}
