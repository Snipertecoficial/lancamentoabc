import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });

// Chainable fake of supabase-js: every builder call is recorded; awaiting the builder
// resolves to whatever mockRespond(query) returns.
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

const mockDownload = jest.fn();
jest.mock("../lib/csv", () => ({ ...jest.requireActual("../lib/csv"), downloadCSV: (...a) => mockDownload(...a) }));

const LeadsPage = require("../pages/LeadsPage").default;
const { EnvProvider, useEnv } = require("../EnvContext");
const { periodRange } = require("../lib/period");

const LEAD = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Ana Souza",
  phone_e164: "+5511940383680",
  email: "ana@example.com",
  created_at: "2026-11-16T23:58:00Z",
  submitted_at: "2026-11-16T23:58:00Z",
  rd_confirmed_at: "2026-11-16T23:59:00Z",
  thank_you_at: "2026-11-17T00:00:00Z",
  whatsapp_at: "2026-11-17T00:04:00Z",
  stage: "foi_whatsapp",
  origin: "google_ads",
  utm_campaign: "lancamento-sp",
  keyword: "apartamento zona sul",
  temperature: "quente",
  last_event_at: "2026-11-17T00:04:00Z",
};

const has = (q, ...call) => q.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));
const isHead = (q) => q.calls.some((c) => c[0] === "select" && c[2] && c[2].head);
const listQueries = () => mockQueries.filter((q) => q.table === "panel_leads" && q.calls.some((c) => c[0] === "range"));
const lastList = () => listQueries()[listQueries().length - 1];

let listResult, kpiCounts, funnelRows;
function defaultRespond(q) {
  if (q.table === "panel_funnel_daily") return { data: funnelRows, error: null };
  if (isHead(q)) {
    if (q.calls.some((c) => c[0] === "in")) return { count: kpiCounts.ads, error: null };
    if (q.calls.some((c) => c[0] === "not")) return { count: kpiCounts.whatsapp, error: null };
    return { count: kpiCounts.total, error: null };
  }
  return listResult;
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
    root.render(<QueryClientProvider client={client}><EnvProvider><LeadsPage /></EnvProvider></QueryClientProvider>);
  });
  await flush();
}
beforeEach(() => {
  sessionStorage.clear();
  mockQueries.length = 0;
  mockNavigate.mockReset();
  mockDownload.mockReset();
  listResult = { data: [LEAD], count: 1, error: null };
  kpiCounts = { total: 12, ads: 9, whatsapp: 4 };
  funnelRows = [{ visits: 150, submitted: 6 }, { visits: 50, submitted: 4 }];
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
async function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("default query: env production, last 7 days, newest first, first page of 50, exact count", async () => {
  await mount();
  const r = periodRange({ period: "7d" });
  const q = lastList();
  expect(q.calls[0]).toEqual(["select", expect.any(String), { count: "exact" }]);
  expect(q.calls[0][1]).not.toMatch(/ip_hash/);
  expect(has(q, "eq", "env", "production")).toBe(true);
  expect(has(q, "gte", "created_at", r.fromIso)).toBe(true);
  expect(has(q, "lt", "created_at", r.toIso)).toBe(true);
  expect(has(q, "order", "created_at", { ascending: false })).toBe(true);
  expect(has(q, "range", 0, 49)).toBe(true);
});

test("renders the lead row: formatted phone, origin, campaign and keyword, stage, temperature", async () => {
  await mount();
  const row = $("table tbody tr");
  expect(row.textContent).toContain("Ana Souza");
  expect(row.textContent).toContain("(11) 94038-3680");
  expect(row.textContent).toContain("Google Ads");
  expect(row.textContent).toContain("lancamento-sp");
  expect(row.textContent).toContain("apartamento zona sul");
  expect(row.textContent).toContain("Foi ao WhatsApp");
  expect(row.textContent).toContain("21:04");
  expect(row.textContent).toContain("Quente");
  expect(row.textContent).toContain("16/11/2026 20:58");
});

test("WhatsApp button opens wa.me with digits in a new tab", async () => {
  await mount();
  const a = $('table a[href^="https://wa.me/"]');
  expect(a.getAttribute("href")).toBe("https://wa.me/5511940383680");
  expect(a.getAttribute("target")).toBe("_blank");
  expect(a.getAttribute("rel")).toMatch(/noopener/);
});

test("clicking a row opens the lead; the WhatsApp button does not", async () => {
  await mount();
  await click($('table a[href^="https://wa.me/"]'));
  expect(mockNavigate).not.toHaveBeenCalled();
  await click($("table tbody tr td:last-child"));
  expect(mockNavigate).toHaveBeenCalledWith(`/painel/leads/${LEAD.id}`);
  expect($(`table a[href="/painel/leads/${LEAD.id}"]`)).not.toBeNull();
});

test("period Hoje changes the created_at range", async () => {
  await mount();
  await click(button("Hoje"));
  const r = periodRange({ period: "hoje" });
  expect(has(lastList(), "gte", "created_at", r.fromIso)).toBe(true);
  expect(has(lastList(), "lt", "created_at", r.toIso)).toBe(true);
});

test("custom period uses the two dates", async () => {
  await mount();
  await click(button("Personalizado"));
  await type($('input[aria-label="De"]'), "2026-11-01");
  await type($('input[aria-label="Até"]'), "2026-11-05");
  await flush();
  expect(has(lastList(), "gte", "created_at", "2026-11-01T03:00:00.000Z")).toBe(true);
  expect(has(lastList(), "lt", "created_at", "2026-11-06T03:00:00.000Z")).toBe(true);
});

test("origin and stage filters go to the server", async () => {
  await mount();
  await choose($('select[aria-label="Origem"]'), "meta_ads");
  expect(has(lastList(), "eq", "origin", "meta_ads")).toBe(true);
  await choose($('select[aria-label="Estágio"]'), "foi_whatsapp");
  expect(has(lastList(), "eq", "stage", "foi_whatsapp")).toBe(true);
  expect(has(lastList(), "eq", "origin", "meta_ads")).toBe(true);
});

test("search (submit) filters name/email/phone with or(ilike)", async () => {
  await mount();
  await type($('input[type="search"]'), "Ana");
  await act(async () => { $('form[role="search"]').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  await flush();
  expect(has(lastList(), "or", 'name.ilike."%Ana%",email.ilike."%Ana%"')).toBe(true);
});

test("environment from context is used", async () => {
  sessionStorage.setItem("radar-painel-env", "staging");
  await mount();
  expect(has(lastList(), "eq", "env", "staging")).toBe(true);
  expect(mockQueries.filter((q) => q.table !== "panel_leads" || isHead(q)).every((q) => has(q, "eq", "env", "staging"))).toBe(true);
});

test("pagination: 50 per page, next/previous change range", async () => {
  listResult = { data: [LEAD], count: 120, error: null };
  await mount();
  expect(container.textContent).toContain("1–50 de 120");
  expect(button("Anterior").disabled).toBe(true);
  await click(button("Próxima"));
  expect(has(lastList(), "range", 50, 99)).toBe(true);
  expect(container.textContent).toContain("51–100 de 120");
  await click(button("Próxima"));
  expect(has(lastList(), "range", 100, 149)).toBe(true);
  expect(button("Próxima").disabled).toBe(true);
  await click(button("Anterior"));
  expect(has(lastList(), "range", 50, 99)).toBe(true);
});

test("changing a filter goes back to page 1", async () => {
  listResult = { data: [LEAD], count: 120, error: null };
  await mount();
  await click(button("Próxima"));
  await choose($('select[aria-label="Origem"]'), "google_ads");
  expect(has(lastList(), "range", 0, 49)).toBe(true);
});

test("switching environment goes back to page 1 (no offset past the end of the other env)", async () => {
  listResult = { data: [LEAD], count: 120, error: null };
  let envApi;
  function EnvProbe() { envApi = useEnv(); return null; }
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<QueryClientProvider client={client}><EnvProvider><LeadsPage /><EnvProbe /></EnvProvider></QueryClientProvider>);
  });
  await flush();
  await click(button("Próxima"));
  await click(button("Próxima"));
  expect(has(lastList(), "range", 100, 149)).toBe(true);
  await act(async () => { envApi.setEnv("staging"); });
  await flush();
  const staging = listQueries().filter((q) => has(q, "eq", "env", "staging"));
  expect(staging.length).toBeGreaterThan(0);
  expect(staging.every((q) => has(q, "range", 0, 49))).toBe(true);
  expect(container.textContent).toContain("1–50 de 120");
});

test("KPIs: totals, ads, WhatsApp and visit->lead rate from the funnel (filtered by env + day range)", async () => {
  await mount();
  const r = periodRange({ period: "7d" });
  const kpi = $('[aria-label="Indicadores do período"]');
  expect(kpi.textContent).toContain("12");
  expect(kpi.textContent).toContain("Leads no período");
  expect(kpi.textContent).toContain("9");
  expect(kpi.textContent).toContain("Leads de anúncios");
  expect(kpi.textContent).toContain("4");
  expect(kpi.textContent).toContain("Chegaram ao WhatsApp");
  expect(kpi.textContent).toContain("5,0%");
  expect(kpi.textContent).toContain("10 de 200 visitas");
  const ads = mockQueries.find((q) => isHead(q) && q.calls.some((c) => c[0] === "in"));
  expect(has(ads, "in", "origin", ["google_ads", "meta_ads"])).toBe(true);
  const wa = mockQueries.find((q) => isHead(q) && q.calls.some((c) => c[0] === "not"));
  expect(has(wa, "not", "whatsapp_at", "is", null)).toBe(true);
  const funnel = mockQueries.find((q) => q.table === "panel_funnel_daily");
  expect(has(funnel, "eq", "env", "production")).toBe(true);
  expect(has(funnel, "gte", "day", r.fromDay)).toBe(true);
  expect(has(funnel, "lte", "day", r.toDay)).toBe(true);
});

test("rate shows a dash without visits", async () => {
  funnelRows = [];
  await mount();
  expect($('[aria-label="Indicadores do período"]').textContent).toContain("—");
});

test("empty state", async () => {
  listResult = { data: [], count: 0, error: null };
  await mount();
  expect(container.textContent).toContain("Nenhum lead neste período");
  expect($("table tbody tr")).toBeNull();
});

test("error state with retry", async () => {
  listResult = { data: null, count: null, error: { message: "boom" } };
  await mount();
  expect($('[role="alert"]').textContent).toContain("Não foi possível carregar os leads");
  const before = listQueries().length;
  listResult = { data: [LEAD], count: 1, error: null };
  await click(button("Tentar de novo"));
  expect(listQueries().length).toBeGreaterThan(before);
  expect($("table tbody tr").textContent).toContain("Ana Souza");
});

test("CSV export fetches every page of the current filter in chunks of 1000", async () => {
  const many = Array.from({ length: 1000 }, (_, i) => ({ ...LEAD, id: `id-${i}` }));
  mockRespond = (q) => {
    const range = q.calls.find((c) => c[0] === "range");
    if (q.table === "panel_leads" && range && range[2] - range[1] === 999) {
      return { data: range[1] === 0 ? many : [{ ...LEAD, id: "last", name: "Bia;Lima" }], error: null };
    }
    return defaultRespond(q);
  };
  await mount();
  await choose($('select[aria-label="Origem"]'), "google_ads");
  await click(button("Exportar CSV"));
  const chunks = mockQueries.filter((q) => q.calls.some((c) => c[0] === "range" && c[2] - c[1] === 999));
  expect(chunks.map((q) => q.calls.find((c) => c[0] === "range").slice(1))).toEqual([[0, 999], [1000, 1999]]);
  chunks.forEach((q) => {
    expect(has(q, "eq", "origin", "google_ads")).toBe(true);
    expect(has(q, "eq", "env", "production")).toBe(true);
    expect(q.calls[0][1]).not.toMatch(/ip_hash/);
  });
  expect(mockDownload).toHaveBeenCalledTimes(1);
  const [filename, text] = mockDownload.mock.calls[0];
  expect(filename).toMatch(/^leads-production-\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}\.csv$/);
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).split("\r\n");
  expect(lines[0].startsWith("ID;Nome;WhatsApp;E-mail")).toBe(true);
  expect(lines).toHaveLength(1 + 1001 + 1);
  expect(lines[1001]).toContain('"Bia;Lima"');
  expect(lines[1]).toContain("(11) 94038-3680");
  expect(text).not.toMatch(/ip_hash/);
});
