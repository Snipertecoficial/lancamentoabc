// Helpers for the "Ao vivo" screen (panel_sessions_live).
import { sectionLabel } from "./eventLabels";

const PAID = ["cpc", "ppc", "paid"];
const META_SOURCES = ["facebook", "instagram", "meta", "fb", "ig"];
const META_PAID = [...PAID, "paid_social", "paidsocial"];

// Same rules as public.panel_origin(), from what the live view carries (landing URL params and
// utm_source). It has no referrer, so organic search and direct visits cannot be told apart: "unpaid".
export function liveOrigin(session) {
  let p;
  try { p = new URL(session.landing_url).searchParams; } catch (e) { p = new URLSearchParams(); }
  const get = (k) => (p.get(k) || "").trim();
  const source = (session.utm_source || get("utm_source")).toLowerCase();
  const medium = get("utm_medium").toLowerCase();
  if (get("gclid") || get("gbraid") || get("wbraid") || (PAID.includes(medium) && source.startsWith("google"))) return "google_ads";
  if (get("fbclid") || (META_SOURCES.includes(source) && META_PAID.includes(medium))) return "meta_ads";
  if (source || medium || get("utm_campaign")) return "other";
  return "unpaid";
}

export function liveSection(section) {
  if (!section) return "";
  return sectionLabel(section) || "Outra parte da página";
}
