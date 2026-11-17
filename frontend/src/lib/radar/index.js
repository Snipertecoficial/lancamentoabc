import { RADAR_URL, RADAR_ENV } from "./config";
import { uuid, getSessionId, getVisitorId, clearVisitorId, startNewSession } from "./ids";
import { hasConsent, onConsentChange } from "./consent";
import { readAttribution, campaignOf, hasCampaignParams } from "./attribution";
import { createQueue } from "./queue";
import { sendBatch } from "./transport";
import * as page from "./collectors/page";
import * as sections from "./collectors/sections";
import * as clicks from "./collectors/clicks";
import * as video from "./collectors/video";
import * as forms from "./collectors/forms";

const ATTR_KEY = "rdr_attr";
const LEAD_KEY = "radar_lead_token";
let inited = false;
let consentOverride = null; // set by the radar:consent event so the decision applies to the very next batch

// The admin panel (/login, /painel/*) lives in the same app but is never tracked.
function onPanelRoute() {
  try { return /^\/(login|painel)(\/|$)/.test(location.pathname); } catch (e) { return false; }
}

function readCached() {
  try {
    const c = sessionStorage.getItem(ATTR_KEY);
    if (c) return JSON.parse(c);
  } catch (e) { /* ignore */ }
  return null;
}

function writeAttr(a) {
  try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(a)); } catch (e) { /* ignore */ }
}

function freshAttribution() {
  return readAttribution(location.href, document.referrer, navigator.userAgent, window.innerWidth);
}

function sessionMeta() {
  const c = readCached();
  if (c) return c;
  const a = freshAttribution();
  writeAttr(a);
  return a;
}

// Called at init and on every page_view (pushState/popstate). A URL carrying campaign params
// overrides the cached attribution; if that changes the campaign, the ad visit becomes its own
// session (the server only stores session meta on first insert). URLs without params keep the cache.
function syncAttribution() {
  try {
    if (!hasCampaignParams(location.href)) return;
    const next = freshAttribution();
    const cached = readCached();
    if (cached && JSON.stringify(campaignOf(cached)) === JSON.stringify(campaignOf(next))) return;
    if (cached) {
      queue.flush(true); // pending events still belong to the old session/attribution
      startNewSession();
    }
    writeAttr(next);
  } catch (e) { /* never throw */ }
}

const queue = createQueue({
  send(events, useBeacon) {
    if (!RADAR_URL) return;
    const body = JSON.stringify({
      v: 1,
      env: RADAR_ENV,
      session_id: getSessionId(),
      visitor_id: getVisitorId(consentOverride === null ? hasConsent() : consentOverride),
      session: sessionMeta(),
      events,
    });
    sendBatch(`${RADAR_URL}/ingest`, body, useBeacon);
  },
});

let stops = [];

export function initRadar() {
  if (inited || !RADAR_URL || onPanelRoute()) return;
  inited = true;
  sessionMeta(); // pin the baseline attribution at init so later ad landings are detected as a change
  syncAttribution();
  // Collectors start BEFORE the flush listeners below: listeners run in registration order, so a
  // collector's pagehide/visibilitychange handler (e.g. sections' section_view) enqueues first
  // and the flush then includes it.
  // Collectors receive `track` as a parameter (avoids a circular import).
  [page, sections, clicks, video, forms].forEach((c) => {
    try { stops.push(c.start(track, identifyLead)); } catch (e) { /* ignore */ }
  });
  try { stops.push(onConsentChange((granted) => { consentOverride = granted; if (!granted) clearVisitorId(); })); } catch (e) { /* ignore */ }
  try {
    const onHide = () => queue.flush(true);
    const onVis = () => { if (document.visibilityState === "hidden") queue.flush(true); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    stops.push(() => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    });
  } catch (e) { /* ignore */ }
}

// Test-only: detach every listener/collector started by initRadar.
export function __stopRadar() {
  stops.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
  stops = [];
  inited = false;
  consentOverride = null;
}

export function track(type, props, opts) {
  if (!RADAR_URL || onPanelRoute()) return;
  try {
    if (type === "page_view") syncAttribution();
    const e = { id: uuid(), type, ts: new Date().toISOString() };
    if (opts && opts.name) e.name = opts.name;
    if (opts && opts.section) e.section = opts.section;
    if (props) e.props = props;
    queue.push(e);
  } catch (err) { /* never throw */ }
}

export function isRadarEnabled() {
  return !!RADAR_URL;
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
