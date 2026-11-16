export type RdLead = {
  name: string | null;
  email: string | null;
  phone_raw: string | null;
  rd_lead_id: string | null;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/** Extrai leads do webhook de conversão do RD Station Marketing ({ leads: [...] }). */
export function parseRdPayload(body: unknown): RdLead[] {
  const leads = (body as { leads?: unknown } | null)?.leads;
  if (!Array.isArray(leads)) return [];
  const out: RdLead[] = [];
  for (const l of leads) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    const id = typeof o.id === "string" || typeof o.id === "number" ? String(o.id) : null;
    out.push({
      name: str(o.name),
      email: str(o.email),
      phone_raw: str(o.mobile_phone) ?? str(o.personal_phone),
      rd_lead_id: id,
    });
  }
  return out;
}
