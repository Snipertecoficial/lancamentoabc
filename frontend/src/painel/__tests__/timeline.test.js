import {
  collapseEvents, groupVisits, formatDuration, formatSeconds, summarize, leadMilestones, deviceLabel, pathOf, hostOf,
} from "../lib/timeline";
import { labelFor } from "../lib/eventLabels";

// t(0) = 2026-11-17T00:02:00Z = 16/11 21:02 in São Paulo.
const BASE = Date.parse("2026-11-17T00:02:00Z");
const t = (sec) => new Date(BASE + sec * 1000).toISOString();
let n = 0;
const ev = (sec, type, props = {}, extra = {}) => ({
  occurred_at: t(sec), session_id: "s1", session_started_at: t(0), device: "mobile",
  type, name: null, section: null, props, _n: (n += 1), ...extra,
});
const labels = (items) => items.map(labelFor);

describe("collapseEvents", () => {
  test("drops consecutive duplicates within 2 s (same type, name, section and props)", () => {
    const out = collapseEvents([
      ev(0, "cta_click", { label: "hero-cta-visit" }),
      ev(1, "cta_click", { label: "hero-cta-visit" }),
      ev(2.5, "cta_click", { label: "hero-cta-visit" }),
      ev(10, "cta_click", { label: "hero-cta-visit" }),
    ]);
    // 1 s and 2.5 s chain to the previous one (each within 2 s); 10 s is a new click.
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.occurred_at)).toEqual([t(0), t(10)]);
  });

  test("keeps duplicates that are not consecutive or differ in props", () => {
    const out = collapseEvents([
      ev(0, "faq_open", { question: "A?" }),
      ev(1, "faq_open", { question: "B?" }),
      ev(1.5, "faq_open", { question: "A?" }),
    ]);
    expect(out).toHaveLength(3);
  });

  test("click coordinates do not make a duplicate different", () => {
    const out = collapseEvents([
      ev(0, "cta_click", { label: "hero-cta-unit", x: 10, y: 20 }),
      ev(0.4, "cta_click", { label: "hero-cta-unit", x: 12, y: 21 }),
    ]);
    expect(out).toHaveLength(1);
  });

  test("video progress: only the max per visit, at its own time; play and unmute stay", () => {
    const out = collapseEvents([
      ev(0, "video", { video: "hero" }, { name: "play" }),
      ev(5, "video", { video: "hero" }, { name: "unmute" }),
      ev(10, "video", { video: "hero", pct: 25 }, { name: "progress" }),
      ev(20, "video", { video: "hero", pct: 50 }, { name: "progress" }),
      ev(25, "section_view", { seconds: 30 }, { section: "top" }),
      ev(30, "video", { video: "hero", pct: 75 }, { name: "progress" }),
      ev(40, "video", { video: "hero" }, { name: "play" }),
    ]);
    expect(labels(out)).toEqual([
      "Deu play no vídeo",
      "Ativou o som do vídeo",
      "Viu a seção Topo/vídeo por 30 s",
      "Assistiu até 75% do vídeo",
      "Deu play no vídeo",
    ]);
    expect(out[3].occurred_at).toBe(t(30));
  });

  test("consecutive scroll_depth collapse into the max; a different event breaks the run", () => {
    const out = collapseEvents([
      ev(0, "scroll_depth", { pct: 25 }),
      ev(3, "scroll_depth", { pct: 50 }),
      ev(9, "scroll_depth", { pct: 75 }),
      ev(12, "faq_open", { question: "Tem vaga?" }),
      ev(15, "scroll_depth", { pct: 90 }),
    ]);
    expect(labels(out)).toEqual(["Rolou até 75% da página", "Abriu a dúvida: Tem vaga?", "Rolou até 90% da página"]);
    expect(out[0].occurred_at).toBe(t(9));
  });

  test("sorts by occurred_at and does not mutate the input", () => {
    const input = [ev(5, "form_start"), ev(1, "page_view", { path: "/" })];
    const copy = JSON.parse(JSON.stringify(input));
    const out = collapseEvents(input);
    expect(labels(out)).toEqual(["Entrou na página", "Começou a preencher o formulário"]);
    expect(input).toEqual(copy);
  });

  test("empty input", () => {
    expect(collapseEvents([])).toEqual([]);
    expect(collapseEvents(undefined)).toEqual([]);
  });
});

describe("groupVisits", () => {
  test("groups by session ordered by session start, numbers visits, duration = last - first event", () => {
    const later = "2026-11-18T13:00:00Z"; // 18/11 10:00 SP
    const s2 = (sec, type, props, extra) => ev(sec, type, props, {
      session_id: "s2", session_started_at: later, device: "desktop", occurred_at: new Date(Date.parse(later) + sec * 1000).toISOString(), ...extra,
    });
    const visits = groupVisits([
      s2(30, "page_view", { path: "/" }),
      ev(0, "page_view", { path: "/" }),
      ev(360, "lead_submitted", {}),
      s2(90, "whatsapp_click", {}),
      ev(120, "scroll_depth", { pct: 50 }),
    ]);
    expect(visits).toHaveLength(2);
    expect(visits[0]).toMatchObject({ number: 1, sessionId: "s1", device: "mobile", durationMs: 360000, startedAt: t(0) });
    expect(visits[0].items.map((e) => e.type)).toEqual(["page_view", "scroll_depth", "lead_submitted"]);
    expect(visits[1]).toMatchObject({ number: 2, sessionId: "s2", device: "desktop", durationMs: 60000, startedAt: later });
  });

  test("falls back to the first event time when session_started_at is missing", () => {
    const visits = groupVisits([ev(10, "page_view", {}, { session_started_at: null })]);
    expect(visits[0].startedAt).toBe(t(10));
    expect(visits[0].durationMs).toBe(0);
  });

  test("no events -> no visits", () => {
    expect(groupVisits([])).toEqual([]);
  });
});

test("formatDuration and formatSeconds", () => {
  expect(formatDuration(0)).toBe("menos de 1 min");
  expect(formatDuration(45000)).toBe("menos de 1 min");
  expect(formatDuration(6 * 60000 + 20000)).toBe("6 min");
  expect(formatDuration(72 * 60000)).toBe("1 h 12 min");
  expect(formatDuration(60 * 60000)).toBe("1 h");
  expect(formatSeconds(42)).toBe("42 s");
  expect(formatSeconds(75)).toBe("1 min 15 s");
  expect(formatSeconds(120)).toBe("2 min");
  expect(formatSeconds(3725)).toBe("1 h 2 min");
  expect(formatSeconds(0)).toBe("0 s");
});

describe("summarize", () => {
  const events = [
    ev(0, "section_view", { seconds: 40 }, { section: "top" }),
    ev(10, "video", { pct: 50 }, { name: "progress" }),
    ev(20, "faq_open", { question: "Qual o valor?" }),
    ev(30, "faq_open", { question: "Tem lazer?" }),
    ev(35, "faq_open", { question: "Qual o valor?" }),
    ev(40, "section_view", { seconds: 22 }, { section: "faq" }),
    ev(50, "video", { pct: 75 }, { name: "progress", session_id: "s2" }),
  ];

  test("time on page = sum of section_view seconds; max video; distinct FAQ in order; visits; origin", () => {
    expect(summarize(events, { origin: "google_ads" })).toEqual({
      totalSeconds: 62,
      videoMaxPct: 75,
      faqQuestions: ["Qual o valor?", "Tem lazer?"],
      visits: 2,
      origin: "google_ads",
    });
  });

  test("uses the lead's server totals when they are larger (events list is capped)", () => {
    const s = summarize([], { origin: "direct", video_max_pct: 100, faq_questions: ["Aceita FGTS?"], visits: 3 });
    expect(s).toEqual({ totalSeconds: 0, videoMaxPct: 100, faqQuestions: ["Aceita FGTS?"], visits: 3, origin: "direct" });
  });

  test("no video -> null", () => {
    expect(summarize([], {}).videoMaxPct).toBeNull();
  });
});

describe("leadMilestones", () => {
  test("three milestones in order, without the legacy RD confirmation", () => {
    const m = leadMilestones({
      created_at: t(0), submitted_at: t(5), rd_confirmed_at: t(6), thank_you_at: t(10), whatsapp_at: null,
    });
    expect(m.map((x) => x.label)).toEqual(["Enviou formulário", "Página de obrigado", "Foi ao WhatsApp"]);
    expect(m.map((x) => x.done)).toEqual([true, true, false]);
    expect(m[0].at).toBe(t(5));
    expect(m[2].at).toBeNull();
    expect(JSON.stringify(m)).not.toMatch(/Confirmado/);
  });

  test("submitted falls back to created_at", () => {
    expect(leadMilestones({ created_at: t(0) })[0]).toMatchObject({ done: true, at: t(0) });
  });
});

test("deviceLabel, pathOf, hostOf", () => {
  expect(deviceLabel("mobile")).toBe("celular");
  expect(deviceLabel("desktop")).toBe("computador");
  expect(deviceLabel("tablet")).toBe("tablet");
  expect(deviceLabel(null)).toBe("");
  expect(pathOf("https://lancamento.espontone.com.br/?gclid=abc&utm_source=google")).toBe("/");
  expect(pathOf("https://lancamento.espontone.com.br/obrigado?x=1")).toBe("/obrigado");
  expect(pathOf("")).toBe("");
  expect(pathOf("not a url")).toBe("");
  expect(hostOf("https://www.google.com/search?q=apartamento")).toBe("www.google.com");
  expect(hostOf(null)).toBe("");
});
