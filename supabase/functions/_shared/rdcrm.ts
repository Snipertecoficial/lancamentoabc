// Copies a site lead into RD Station CRM as a new deal (API v1, token per CRM user in the query string).
// Best effort: the lead is already saved in the Radar; a failure here only logs, never with personal data.

export type CrmLead = {
  name: string;
  phone_e164: string;
  email: string | null;
  intent: "morar" | "investir" | null;
};

const RD_CRM_DEALS = "https://crm.rdstation.com/api/v1/deals";
const TIMEOUT_MS = 8000;

export function rdCrmDealBody(lead: CrmLead) {
  return {
    deal: { name: `${lead.name} — Site lançamento SA/SBC${lead.intent ? ` (${lead.intent})` : ""}` },
    contacts: [{
      name: lead.name,
      phones: [{ phone: lead.phone_e164, type: "cellphone" }],
      emails: lead.email ? [{ email: lead.email }] : [],
    }],
  };
}

export async function sendToRdCrm(
  token: string,
  lead: CrmLead,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchFn(`${RD_CRM_DEALS}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(rdCrmDealBody(lead)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`rd-crm: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch {
    console.error("rd-crm: falha de rede");
    return false;
  }
}
