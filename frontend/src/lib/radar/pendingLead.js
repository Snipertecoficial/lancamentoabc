import { RADAR_URL } from "./config";
import { leadBody } from "./leadBody";
import { submitLead } from "./submitLead";

// "Pegar o contato de todo jeito": when submit-lead may never have reached the server, the lead
// is not dropped. A beacon is fired at once (the browser delivers it even if it cannot read the
// answer), and the fields stay in this tab's sessionStorage for one silent retry on the next load.
// The server merges leads by phone, so a beacon + retry that both land do not create two leads.
export const PENDING_KEY = "radar_pending_lead";

// Failures without a definitive answer from the server. Validation errors (invalid_*),
// rate_limited and invalid_request are answers: retrying them would not help.
const RESCUABLE = new Set(["network", "timeout", "server", "server_error"]);
export const isRescuable = (error) => RESCUABLE.has(error);

export function rescueLead(fields) {
  if (!RADAR_URL) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([JSON.stringify(leadBody(fields))], { type: "text/plain;charset=UTF-8" });
      navigator.sendBeacon(`${RADAR_URL}/submit-lead`, blob);
    }
  } catch (e) { /* best effort */ }
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(fields)); } catch (e) { /* ignore */ }
}

export function clearPendingLead() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
}

// One silent attempt per stored lead: the key is removed before sending, so a failed retry is not
// stored again. Never throws; resolves to submitLead's result, or null when nothing was pending.
export async function retryPendingLead() {
  if (!RADAR_URL) return null;
  let fields = null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    fields = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!fields || typeof fields !== "object") return null;
  return submitLead(fields);
}
