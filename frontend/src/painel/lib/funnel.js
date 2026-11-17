// Funnel math over panel_funnel_daily rows (one row per day x env x origin).
import { addDays } from "./period";

export const FUNNEL_STEPS = [
  { key: "visits", label: "Visitas" },
  { key: "watched_video", label: "Assistiram o vídeo" },
  { key: "reached_form", label: "Chegaram ao formulário" },
  { key: "started_form", label: "Começaram a preencher" },
  { key: "submitted", label: "Enviaram" },
  { key: "thank_you", label: "Página de obrigado" },
  { key: "whatsapp", label: "Foram ao WhatsApp" },
];

const n = (v) => Number(v) || 0;

// Totals per step, % of visits, % lost from the previous step and the step with the largest loss
// (earliest on a tie; null when nothing drops).
export function sumFunnel(rows) {
  const totals = FUNNEL_STEPS.map((s) => (rows || []).reduce((acc, r) => acc + n(r[s.key]), 0));
  const visits = totals[0];
  let biggestDrop = null;
  let biggest = 0;
  const steps = FUNNEL_STEPS.map((s, i) => {
    const count = totals[i];
    const prev = i > 0 ? totals[i - 1] : 0;
    const dropPct = i > 0 && prev > 0 ? ((prev - count) / prev) * 100 : null;
    if (dropPct !== null && dropPct > biggest) { biggest = dropPct; biggestDrop = s.key; }
    return { ...s, count, pctOfVisits: visits ? (count / visits) * 100 : null, dropPct };
  });
  return { visits, steps, biggestDrop };
}

// Leads (submitted) per Sao Paulo day, one entry for every day from fromDay to toDay.
export function leadsPerDay(rows, fromDay, toDay) {
  const byDay = {};
  (rows || []).forEach((r) => { byDay[r.day] = (byDay[r.day] || 0) + n(r.submitted); });
  const out = [];
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) {
    out.push({ day: d, label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, leads: byDay[d] || 0 });
  }
  return out;
}

export function sortCampaigns(rows) {
  return (rows || []).slice().sort((a, b) => n(b.leads) - n(a.leads)
    || n(b.visits) - n(a.visits)
    || String(a.utm_campaign || "￿").localeCompare(String(b.utm_campaign || "￿"), "pt-BR"));
}
