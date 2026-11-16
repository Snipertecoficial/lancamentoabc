import { RADAR_URL, RADAR_ENV } from "./config";
import { uuid, getSessionId, getVisitorId } from "./ids";
import { hasConsent } from "./consent";
import { readAttribution } from "./attribution";
import { createQueue } from "./queue";
import { sendBatch } from "./transport";
import * as page from "./collectors/page";
import * as sections from "./collectors/sections";
import * as clicks from "./collectors/clicks";
import * as video from "./collectors/video";

const ATTR_KEY = "rdr_attr";
const LEAD_KEY = "radar_lead_token";
let inited = false;

function sessionMeta() {
  try {
    const c = sessionStorage.getItem(ATTR_KEY);
    if (c) return JSON.parse(c);
  } catch (e) { /* ignore */ }
  const a = readAttribution(location.href, document.referrer, navigator.userAgent, window.innerWidth);
  try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(a)); } catch (e) { /* ignore */ }
  return a;
}

const queue = createQueue({
  send(events, useBeacon) {
    if (!RADAR_URL) return;
    const body = JSON.stringify({
      v: 1,
      env: RADAR_ENV,
      session_id: getSessionId(),
      visitor_id: getVisitorId(hasConsent()),
      session: sessionMeta(),
      events,
    });
    sendBatch(`${RADAR_URL}/ingest`, body, useBeacon);
  },
});

export function initRadar() {
  if (inited || !RADAR_URL) return;
  inited = true;
  try {
    window.addEventListener("pagehide", () => queue.flush(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") queue.flush(true);
    });
  } catch (e) { /* ignore */ }
  // Collectors receive `track` as a parameter (avoids a circular import).
  [page, sections, clicks, video].forEach((c) => {
    try { c.start(track); } catch (e) { /* ignore */ }
  });
}

export function track(type, props, opts) {
  if (!RADAR_URL) return;
  try {
    const e = { id: uuid(), type, ts: new Date().toISOString() };
    if (opts && opts.name) e.name = opts.name;
    if (opts && opts.section) e.section = opts.section;
    if (props) e.props = props;
    queue.push(e);
  } catch (err) { /* never throw */ }
}

export function getLeadToken() {
  try { return sessionStorage.getItem(LEAD_KEY); } catch (e) { return null; }
}

export function identifyLead({ name, phone, email, formId }) {
  const token = uuid();
  try { sessionStorage.setItem(LEAD_KEY, token); } catch (e) { /* ignore */ }
  track("lead_submitted", { lead_token: token, form_id: formId, name, phone, email });
  try { queue.flush(true); } catch (e) { /* ignore */ }
  return token;
}

export async function confirmLead(token, timeoutMs = 3000) {
  if (!RADAR_URL) return null;
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${RADAR_URL}/confirm-lead`, {
      method: "POST",
      body: JSON.stringify({ lead_token: token }),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      signal: ctl ? ctl.signal : undefined,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? { first_use: !!j.first_use, user_data: j.user_data || null } : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}
