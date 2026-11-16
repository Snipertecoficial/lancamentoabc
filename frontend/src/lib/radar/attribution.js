const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid", "keyword", "matchtype", "campaign_id", "adgroup_id"];

export function readAttribution(href, referrer, userAgent, width) {
  const out = { referrer: referrer || "", lang: "" };
  try {
    const u = new URL(href);
    for (const k of KEYS) {
      const v = u.searchParams.get(k);
      if (v) out[k] = v;
    }
    u.hash = "";
    out.landing_url = u.toString();
  } catch (e) {
    out.landing_url = String(href || "").split("#")[0];
  }
  const ua = userAgent || "";
  out.device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))
    ? "tablet"
    : /Mobi|iPhone|Android/i.test(ua) ? "mobile" : "desktop";
  const h = typeof screen !== "undefined" && screen.height ? screen.height : 0;
  out.screen = `${width}x${h}`;
  try { out.lang = navigator.language || ""; } catch (e) { /* ignore */ }
  return out;
}
