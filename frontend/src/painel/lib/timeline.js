// Lead timeline: group panel_lead_events into visits, collapse noise, summarize.
import { STAGES } from "./stage";

const DUP_WINDOW_MS = 2000;
const time = (e) => Date.parse(e.occurred_at) || 0;
const propsOf = (e) => (e && e.props && typeof e.props === "object" ? e.props : {});
const pctOf = (e) => {
  const n = Number(propsOf(e).pct);
  return propsOf(e).pct !== null && propsOf(e).pct !== "" && Number.isFinite(n) ? n : null;
};
const isProgress = (e) => e.type === "video" && e.name === "progress";

// Identity for duplicate detection; click coordinates are not shown, so they do not count.
function eventKey(e) {
  const { x, y, ...rest } = propsOf(e);
  const props = Object.keys(rest).sort().map((k) => [k, rest[k]]);
  return JSON.stringify([e.type, e.name || null, e.section || null, props]);
}

const byTime = (events) => (events || []).map((e, i) => [e, i])
  .sort((a, b) => time(a[0]) - time(b[0]) || a[1] - b[1])
  .map(([e]) => e);

// One visit's events -> what the timeline shows:
// 1) video progress: only the highest % of the visit (at the moment it was reached);
// 2) consecutive repeats of the same event within 2 s: shown once;
// 3) consecutive scroll_depth: one line with the deepest %.
export function collapseEvents(events) {
  const sorted = byTime(events);
  let best = null;
  sorted.forEach((e) => {
    if (isProgress(e) && pctOf(e) !== null && (!best || pctOf(e) > pctOf(best))) best = e;
  });
  const noProgress = sorted.filter((e) => !isProgress(e) || e === best || (pctOf(e) === null && !best));

  const deduped = [];
  let prev = null;
  noProgress.forEach((e) => {
    const dup = prev && eventKey(prev) === eventKey(e) && time(e) - time(prev) <= DUP_WINDOW_MS;
    prev = e;
    if (!dup) deduped.push(e);
  });

  const out = [];
  deduped.forEach((e) => {
    const last = out[out.length - 1];
    if (e.type === "scroll_depth" && last && last.type === "scroll_depth") {
      if ((pctOf(e) ?? -1) >= (pctOf(last) ?? -1)) out[out.length - 1] = e;
      return;
    }
    out.push(e);
  });
  return out;
}

// Events -> visits (one per session), oldest first.
export function groupVisits(events) {
  const groups = new Map();
  byTime(events).forEach((e) => {
    const key = e.session_id || "sem-sessao";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  return [...groups.entries()]
    .map(([sessionId, evs]) => {
      const first = evs[0];
      const last = evs[evs.length - 1];
      return {
        sessionId,
        startedAt: first.session_started_at || first.occurred_at,
        device: first.device || null,
        firstAt: first.occurred_at,
        lastAt: last.occurred_at,
        durationMs: Math.max(0, time(last) - time(first)),
        items: collapseEvents(evs),
      };
    })
    .sort((a, b) => (Date.parse(a.startedAt) || 0) - (Date.parse(b.startedAt) || 0))
    .map((v, i) => ({ ...v, number: i + 1 }));
}

// Visit length, coarse: "menos de 1 min", "6 min", "1 h 12 min".
export function formatDuration(ms) {
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

// Precise seconds: "42 s", "1 min 15 s", "1 h 2 min".
export function formatSeconds(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Top-of-timeline facts. The lead row carries server totals over all events; the event list
// is capped, so the larger of the two wins.
export function summarize(events, lead) {
  const evs = events || [];
  const l = lead || {};
  let totalSeconds = 0;
  let video = null;
  const faq = [];
  const sessions = new Set();
  evs.forEach((e) => {
    if (e.session_id) sessions.add(e.session_id);
    const p = propsOf(e);
    if (e.type === "section_view") {
      const s = Number(p.seconds);
      if (Number.isFinite(s) && s > 0) totalSeconds += s;
    } else if (isProgress(e) && pctOf(e) !== null) {
      video = Math.max(video ?? 0, pctOf(e));
    } else if (e.type === "faq_open" && typeof p.question === "string" && p.question.trim() && !faq.includes(p.question.trim())) {
      faq.push(p.question.trim());
    }
  });
  const serverVideo = Number(l.video_max_pct);
  if (l.video_max_pct !== null && l.video_max_pct !== undefined && Number.isFinite(serverVideo)) {
    video = Math.max(video ?? 0, serverVideo);
  }
  const serverFaq = Array.isArray(l.faq_questions) ? l.faq_questions.filter(Boolean) : [];
  return {
    totalSeconds,
    videoMaxPct: video,
    faqQuestions: serverFaq.length >= faq.length ? serverFaq : faq,
    visits: Math.max(sessions.size, Number(l.visits) || 0),
    origin: l.origin,
  };
}

// Milestones shown on the lead page. The RD confirmation is legacy (RD was removed), so it is left out.
export function leadMilestones(lead) {
  return STAGES.filter((s) => s.value !== "confirmado_rd").map((s) => {
    const at = s.at(lead || {}) || null;
    return { key: s.value, label: s.label, color: s.color, at, done: Boolean(at) };
  });
}

const DEVICES = { mobile: "celular", desktop: "computador", tablet: "tablet" };
export function deviceLabel(device) {
  if (!device) return "";
  return DEVICES[device] || String(device);
}

function parseUrl(u) {
  if (!u) return null;
  try { return new URL(u); } catch (e) { return null; }
}
export function pathOf(url) {
  const u = parseUrl(url);
  return u ? u.pathname : "";
}
export function hostOf(url) {
  const u = parseUrl(url);
  return u ? u.hostname : "";
}
