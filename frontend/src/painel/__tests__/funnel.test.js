import { FUNNEL_STEPS, sumFunnel, leadsPerDay, sortCampaigns } from "../lib/funnel";

const row = (o) => ({ visits: 0, watched_video: 0, reached_form: 0, started_form: 0, submitted: 0, thank_you: 0, whatsapp: 0, ...o });

test("steps are the seven funnel stages in order, with Portuguese labels", () => {
  expect(FUNNEL_STEPS.map((s) => s.key)).toEqual(["visits", "watched_video", "reached_form", "started_form", "submitted", "thank_you", "whatsapp"]);
  expect(FUNNEL_STEPS.map((s) => s.label)).toEqual([
    "Visitas", "Assistiram o vídeo", "Chegaram ao formulário", "Começaram a preencher", "Enviaram", "Página de obrigado", "Foram ao WhatsApp",
  ]);
});

test("sums rows (days x origins), % of visits and drop-off from the previous step", () => {
  const f = sumFunnel([
    row({ day: "2026-11-15", origin: "google_ads", visits: 120, watched_video: 60, reached_form: 30, started_form: 12, submitted: 6, thank_you: 5, whatsapp: 3 }),
    row({ day: "2026-11-16", origin: "meta_ads", visits: 80, watched_video: 40, reached_form: 10, started_form: 8, submitted: 4, thank_you: 4, whatsapp: "1" }),
  ]);
  expect(f.visits).toBe(200);
  expect(f.steps.map((s) => s.count)).toEqual([200, 100, 40, 20, 10, 9, 4]);
  expect(f.steps[0].pctOfVisits).toBe(100);
  expect(f.steps[1].pctOfVisits).toBe(50);
  expect(f.steps[6].pctOfVisits).toBe(2);
  expect(f.steps[0].dropPct).toBeNull();
  expect(f.steps[1].dropPct).toBe(50);
  expect(f.steps[2].dropPct).toBe(60);
  expect(f.steps[5].dropPct).toBeCloseTo(10);
});

test("biggest drop is the step with the largest % lost from the previous one", () => {
  const f = sumFunnel([row({ visits: 100, watched_video: 90, reached_form: 20, started_form: 15, submitted: 10, thank_you: 9, whatsapp: 2 })]);
  // 90 -> 20 and 9 -> 2 both lose 77.8%: on a tie the earlier step wins.
  expect(f.biggestDrop).toBe("reached_form");
  const g = sumFunnel([row({ visits: 100, watched_video: 90, reached_form: 80, started_form: 70, submitted: 60, thank_you: 50, whatsapp: 5 })]);
  expect(g.biggestDrop).toBe("whatsapp");
});

test("no visits: no percentages, no biggest drop; a step above the previous one is not a drop", () => {
  const empty = sumFunnel([]);
  expect(empty.visits).toBe(0);
  expect(empty.steps.every((s) => s.count === 0 && s.pctOfVisits === null)).toBe(true);
  expect(empty.biggestDrop).toBeNull();
  const odd = sumFunnel([row({ visits: 10, watched_video: 0, reached_form: 3 })]);
  expect(odd.steps[2].dropPct).toBeNull(); // previous step is 0
  expect(odd.biggestDrop).toBe("watched_video");
  const rising = sumFunnel([row({ visits: 10, watched_video: 10, reached_form: 10, started_form: 10, submitted: 10, thank_you: 10, whatsapp: 10 })]);
  expect(rising.biggestDrop).toBeNull();
});

test("leads per day: every day of the range, summing origins, empty days as 0", () => {
  const days = leadsPerDay([
    { day: "2026-11-14", submitted: 2 },
    { day: "2026-11-14", submitted: 1 },
    { day: "2026-11-16", submitted: 4 },
    { day: "2026-11-30", submitted: 9 }, // outside the range
  ], "2026-11-13", "2026-11-16");
  expect(days).toEqual([
    { day: "2026-11-13", label: "13/11", leads: 0 },
    { day: "2026-11-14", label: "14/11", leads: 3 },
    { day: "2026-11-15", label: "15/11", leads: 0 },
    { day: "2026-11-16", label: "16/11", leads: 4 },
  ]);
  expect(leadsPerDay([], "2026-11-16", "2026-11-16")).toEqual([{ day: "2026-11-16", label: "16/11", leads: 0 }]);
});

test("campaigns sorted by leads desc, then visits desc, then name", () => {
  const sorted = sortCampaigns([
    { utm_campaign: "b", leads: 2, visits: 50 },
    { utm_campaign: "a", leads: 5, visits: 10 },
    { utm_campaign: "c", leads: 2, visits: 80 },
    { utm_campaign: null, leads: 0, visits: 300 },
    { utm_campaign: "d", leads: "2", visits: 80 },
  ]);
  expect(sorted.map((c) => c.utm_campaign)).toEqual(["a", "c", "d", "b", null]);
});
