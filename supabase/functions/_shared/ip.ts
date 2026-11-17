import { sha256Hex } from "./hash.ts";

/**
 * IP do cliente a partir de cabeçalhos que o cliente não controla: cf-connecting-ip, x-real-ip e,
 * por último, a ÚLTIMA entrada de x-forwarded-for (a primeira é forjável pelo cliente).
 */
export function clientIp(req: Request): string {
  const h = (k: string) => (req.headers.get(k) ?? "").trim();
  const xff = h("x-forwarded-for").split(",").map((s) => s.trim()).filter(Boolean);
  return h("cf-connecting-ip") || h("x-real-ip") || xff[xff.length - 1] || "";
}

/** sha256(IP do cliente + salt + data UTC). Mesma derivação para ingest e submit-lead. */
export async function ipHashOf(req: Request, salt: string, now: Date): Promise<string> {
  return await sha256Hex(clientIp(req) + salt + now.toISOString().slice(0, 10));
}
