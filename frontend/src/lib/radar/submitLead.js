import { RADAR_URL, RADAR_ENV } from "./config";
import { getSessionId, getVisitorId } from "./ids";
import { hasConsent } from "./consent";

const LEAD_KEY = "radar_lead_token"; // same key identifyLead/getLeadToken use
export const SUBMIT_TIMEOUT_MS = 8000;

// Sends the native form to the submit-lead Edge Function. Never throws; always settles within
// timeoutMs. Success stores the server's lead_token for /obrigado (confirm-lead -> generate_lead).
// Errors: server code ("invalid_phone", "rate_limited", ...), "server_error", "network",
// "timeout" or "disabled" (no RADAR_URL).
export async function submitLead(
  { name, phone, email, intent, formId, hp, elapsedMs },
  timeoutMs = SUBMIT_TIMEOUT_MS,
) {
  if (!RADAR_URL) return { ok: false, error: "disabled" };
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      if (ctl) ctl.abort();
      resolve({ ok: false, error: "timeout" });
    }, timeoutMs);
  });

  const request = (async () => {
    const body = {
      env: RADAR_ENV,
      session_id: getSessionId(),
      visitor_id: getVisitorId(hasConsent()),
      name,
      phone,
      form_id: formId,
      hp: hp || "",
      elapsed_ms: elapsedMs,
    };
    if (email) body.email = email;
    if (intent) body.intent = intent;
    try {
      const r = await fetch(`${RADAR_URL}/submit-lead`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" }, // simple request: no CORS preflight
        body: JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined,
      });
      let j = null;
      try { j = await r.json(); } catch (e) { /* non-JSON body */ }
      if (r.ok && j && j.ok === true && j.lead_token) {
        try { sessionStorage.setItem(LEAD_KEY, j.lead_token); } catch (e) { /* ignore */ }
        return { ok: true, token: j.lead_token };
      }
      return { ok: false, error: (j && typeof j.error === "string" && j.error) || "server_error" };
    } catch (e) {
      return { ok: false, error: "network" };
    }
  })();

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
