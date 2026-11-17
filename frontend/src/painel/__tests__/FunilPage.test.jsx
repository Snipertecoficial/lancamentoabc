import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  useNavigate: () => jest.fn(),
}), { virtual: true });

// Recharts needs real layout; the chart gets its data through a stub that exposes it.
jest.mock("recharts", () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    BarChart: ({ data, children }) => <div data-testid="leads-chart" data-points={JSON.stringify(data)}>{children}</div>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
  };
});

const mockQueries = [];
let mockRespond;
jest.mock("../supabase", () => ({
  supabase: {
    from(table) {
      const q = { table, calls: [] };
      mockQueries.push(q);
      const b = new Proxy({}, {
        get(_, prop) {
          if (prop === "then") return (ok, ko) => Promise.resolve().then(() => mockRespond(q)).then(ok, ko);
          return (...args) => { q.calls.push([prop, ...args]); return b; };
        },
      });
      return b;
    },
  },
}));

const FunilPage = require("../pages/FunilPage").default;
const { EnvProvider } = require("../EnvContext");
const { periodRange } = require("../lib/period");

const has = (q, ...call) => q.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));
const last = (table) => mockQueries.filter((q) => q.table === table).slice(-1)[0];

let funnelRows, campaignRows, funnelError, campaignError;
function defaultRespond(q) {
  if (q.table === "panel_funnel_daily") return funnelError ? { data: null, error: funnelError } : { data: funnelRows, error: null };
  if (q.table === "panel_campaigns_daily") return campaignError ? { data: null, error: campaignError } : { data: campaignRows, error: null };
  return { data: [], error: null };
}

let root, container, client;
async function flush() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}
async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<QueryClientProvider client={client}><EnvProvider><FunilPage /></EnvProvider></QueryClientProvider>);
  });
  await flush();
}

const r7 = periodRange({ period: "7d" });
beforeEach(() => {
  sessionStorage.clear();
  mockQueries.length = 0;
  funnelError = null;
  campaignError = null;
  funnelRows = [
    { day: r7.toDay, origin: "google_ads", visits: 150, watched_video: 90, reached_form: 30, started_form: 12, submitted: 6, thank_you: 5, whatsapp: 3 },
    { day: r7.fromDay, origin: "meta_ads", visits: 50, watched_video: 10, reached_form: 10, started_form: 8, submitted: 4, thank_you: 4, whatsapp: 1 },
  ];
  campaignRows = [
    { day: r7.fromDay, origin: "meta_ads", utm_campaign: "meta-video", keyword: null, visits: 40, leads: 1 },
    { day: r7.fromDay, origin: "google_ads", utm_campaign: "sbc-search", keyword: "apartamento sbc", visits: 70, leads: 3 },
    { day: r7.toDay, origin: "google_ads", utm_campaign: "sbc-search", keyword: "apartamento sbc", visits: 50, leads: 4 },
    { day: r7.toDay, origin: "direct", utm_campaign: null, keyword: null, visits: 300, leads: 0 },
  ];
  mockRespond = defaultRespond;
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  client.clear();
});

const $ = (sel) => container.querySelector(sel);
const $$ = (sel) => [...container.querySelectorAll(sel)];
const button = (text) => $$("button").find((b) => b.textContent.trim() === text);
async function click(el) { await act(async () => { el.click(); }); await flush(); }
async function choose(select, value) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

test("funnel query: env production, last 7 days by day, only the funnel columns", async () => {
  await mount();
  const q = last("panel_funnel_daily");
  expect(q.calls[0][0]).toBe("select");
  expect(q.calls[0][1]).toBe("day,origin,visits,watched_video,reached_form,started_form,submitted,thank_you,whatsapp");
  expect(has(q, "eq", "env", "production")).toBe(true);
  expect(has(q, "gte", "day", r7.fromDay)).toBe(true);
  expect(has(q, "lte", "day", r7.toDay)).toBe(true);
  expect(q.calls.some((c) => c[0] === "eq" && c[1] === "origin")).toBe(false);
});

test("funnel shows each step with count, % of visits and drop-off; the biggest drop is marked", async () => {
  await mount();
  const funnel = $('[aria-label="Funil do período"]');
  const steps = [...funnel.querySelectorAll("li[data-step]")];
  expect(steps.map((s) => s.getAttribute("data-step"))).toEqual(["visits", "watched_video", "reached_form", "started_form", "submitted", "thank_you", "whatsapp"]);
  expect(steps[0].textContent).toContain("Visitas");
  expect(steps[0].textContent).toContain("200");
  expect(steps[1].textContent).toContain("Assistiram o vídeo");
  expect(steps[1].textContent).toContain("100");
  expect(steps[1].textContent).toContain("50% das visitas");
  expect(steps[1].textContent).toContain("−50%");
  expect(steps[2].textContent).toContain("−60%");
  expect(steps[6].textContent).toContain("Foram ao WhatsApp");
  expect(steps[6].textContent).toContain("2% das visitas");
  // Losses: -50%, -60%, -50%, -50%, -10%, -55.6%. Biggest: reached_form (100 -> 40).
  const biggest = funnel.querySelectorAll('[data-biggest="true"]');
  expect(biggest).toHaveLength(1);
  expect(biggest[0].getAttribute("data-step")).toBe("reached_form");
  expect(biggest[0].textContent).toContain("Maior perda");
});

test("leads per day chart covers every day of the period, empty days as 0", async () => {
  await mount();
  const points = JSON.parse($('[data-testid="leads-chart"]').getAttribute("data-points"));
  expect(points).toHaveLength(7);
  expect(points[0]).toMatchObject({ day: r7.fromDay, leads: 4 });
  expect(points[6]).toMatchObject({ day: r7.toDay, leads: 6 });
  expect(points.slice(1, 6).every((p) => p.leads === 0)).toBe(true);
});

test("campaigns: env + period, summed per campaign/keyword across days, sorted by leads", async () => {
  await mount();
  const q = last("panel_campaigns_daily");
  expect(q.calls[0]).toEqual(["select", "day,origin,utm_campaign,keyword,visits,leads"]);
  expect(has(q, "eq", "env", "production")).toBe(true);
  expect(has(q, "gte", "day", r7.fromDay)).toBe(true);
  expect(has(q, "lte", "day", r7.toDay)).toBe(true);
  expect(has(q, "range", 0, 999)).toBe(true);
  expect(mockQueries.some((x) => x.table === "panel_campaigns")).toBe(false);
  const section = $('[aria-label="Campanhas"]');
  expect(section.textContent).not.toMatch(/desde o início/i);
  const rows = [...section.querySelectorAll("table tbody tr")];
  expect(rows.map((r) => r.cells[1].textContent)).toEqual(["sbc-search", "meta-video", "Sem campanha"]);
  expect(rows[0].textContent).toContain("Google Ads");
  expect(rows[0].textContent).toContain("apartamento sbc");
  expect(rows[0].cells[3].textContent).toBe("120");
  expect(rows[0].cells[4].textContent).toBe("7");
  expect(rows[0].cells[5].textContent).toBe("5,8%");
  const cards = [...section.querySelectorAll("ul li")];
  expect(cards[0].textContent).toContain("sbc-search");
});

test("campaigns follow the period", async () => {
  await mount();
  await click(button("Hoje"));
  const h = periodRange({ period: "hoje" });
  expect(has(last("panel_campaigns_daily"), "gte", "day", h.fromDay)).toBe(true);
  expect(has(last("panel_campaigns_daily"), "lte", "day", h.toDay)).toBe(true);
});

test("origin filter goes to the funnel and the campaigns queries", async () => {
  await mount();
  await choose($('select[aria-label="Origem"]'), "google_ads");
  expect(has(last("panel_funnel_daily"), "eq", "origin", "google_ads")).toBe(true);
  expect(has(last("panel_campaigns_daily"), "eq", "origin", "google_ads")).toBe(true);
  expect(has(last("panel_funnel_daily"), "eq", "env", "production")).toBe(true);
});

test("period Hoje and custom change the day range", async () => {
  await mount();
  await click(button("Hoje"));
  const h = periodRange({ period: "hoje" });
  expect(has(last("panel_funnel_daily"), "gte", "day", h.fromDay)).toBe(true);
  expect(has(last("panel_funnel_daily"), "lte", "day", h.toDay)).toBe(true);
  await click(button("Personalizado"));
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    const de = $('input[aria-label="De"]');
    setter.call(de, "2026-11-01");
    de.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    const ate = $('input[aria-label="Até"]');
    setter.call(ate, "2026-11-05");
    ate.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
  expect(has(last("panel_funnel_daily"), "gte", "day", "2026-11-01")).toBe(true);
  expect(has(last("panel_funnel_daily"), "lte", "day", "2026-11-05")).toBe(true);
});

test("staging environment from context is used everywhere", async () => {
  sessionStorage.setItem("radar-painel-env", "staging");
  await mount();
  expect(mockQueries.length).toBeGreaterThan(0);
  expect(mockQueries.every((q) => has(q, "eq", "env", "staging"))).toBe(true);
});

test("long periods page through the funnel rows 1000 at a time", async () => {
  const many = Array.from({ length: 1000 }, () => ({ day: r7.toDay, origin: "direct", visits: 1, watched_video: 0, reached_form: 0, started_form: 0, submitted: 0, thank_you: 0, whatsapp: 0 }));
  mockRespond = (q) => {
    if (q.table !== "panel_funnel_daily") return defaultRespond(q);
    const range = q.calls.find((c) => c[0] === "range");
    return { data: range[1] === 0 ? many : [{ ...many[0], visits: 5 }], error: null };
  };
  await mount();
  const ranges = mockQueries.filter((q) => q.table === "panel_funnel_daily").map((q) => q.calls.find((c) => c[0] === "range").slice(1));
  expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  expect($('[aria-label="Funil do período"] li[data-step="visits"]').textContent).toContain("1.005");
});

test("empty period: a message instead of the funnel", async () => {
  funnelRows = [];
  campaignRows = [];
  await mount();
  expect(container.textContent).toContain("Nenhuma visita neste período");
  expect($('[aria-label="Funil do período"] li[data-step]')).toBeNull();
  expect($('[aria-label="Campanhas"]').textContent).toContain("Nenhuma campanha neste período");
});

test("errors show a retry", async () => {
  funnelError = { message: "boom" };
  campaignError = { message: "boom" };
  await mount();
  const alerts = $$('[role="alert"]').map((a) => a.textContent);
  expect(alerts.some((t) => t.includes("Não foi possível carregar o funil"))).toBe(true);
  expect(alerts.some((t) => t.includes("Não foi possível carregar as campanhas"))).toBe(true);
  funnelError = null;
  campaignError = null;
  const before = mockQueries.length;
  await click($$("button").filter((b) => b.textContent.includes("Tentar de novo"))[0]);
  expect(mockQueries.length).toBeGreaterThan(before);
});

test("filters sheet (phones) counts active filters and Limpar resets them", async () => {
  await mount();
  const trigger = $('button[aria-controls="filtros-funil"]');
  await click(trigger);
  expect($('#filtros-funil[role="dialog"]')).not.toBeNull();
  await choose($('select[aria-label="Origem"]'), "meta_ads");
  expect(trigger.textContent).toContain("1");
  await click(button("Limpar"));
  expect(has(last("panel_funnel_daily"), "eq", "origin", "meta_ads")).toBe(false);
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
  expect($('#filtros-funil[role="dialog"]')).toBeNull();
});
