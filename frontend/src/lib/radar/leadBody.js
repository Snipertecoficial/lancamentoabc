import { RADAR_ENV } from "./config";
import { getSessionId, getVisitorId } from "./ids";
import { hasConsent } from "./consent";
import { sessionMeta } from "./index";

// The submit-lead request body. Shared by submitLead (fetch) and the sendBeacon rescue
// (pendingLead.js), so both always send the exact same contract.
export function leadBody({ name, phone, email, intent, formId, hp, elapsedMs }) {
  const body = {
    env: RADAR_ENV,
    session_id: getSessionId(),
    visitor_id: getVisitorId(hasConsent()),
    session: sessionMeta(), // same SessionMeta as the ingest batches (landing_url, utm_*, gclid...)
    name,
    phone,
    form_id: formId,
    hp: hp || "",
    elapsed_ms: elapsedMs,
  };
  if (email) body.email = email;
  if (intent) body.intent = intent;
  return body;
}
