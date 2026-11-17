import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockParams = {};
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  useParams: () => mockParams,
  useNavigate: () => jest.fn(),
}), { virtual: true });

// Chainable fake of supabase-js (same pattern as LeadsPage.test): calls are recorded and
// awaiting the builder resolves to mockRespond(query).
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

const LeadPage = require("../pages/LeadPage").default;

const ID = "11111111-1111-1111-1111-111111111111";
const LEAD = {
  id: ID,
  env: "production",
  name: "Ana Souza",
  phone_e164: "+5511940383680",
  email: "ana@example.com",
  created_at: "2026-11-17T00:08:00Z",
  submitted_at: "2026-11-17T00:08:00Z",
  rd_confirmed_at: null,
  thank_you_at: "2026-11-17T00:08:30Z",
  whatsapp_at: null,
  stage: "chegou_obrigado",
  origin: "google_ads",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "lancamento-sp",
  utm_term: null,
  keyword: "apartamento zona sul",
  gclid: "Cj0KCQiA-gclid-123",
  device: "mobile",
  landing_url: "https://lancamento.espontone.com.br/?gclid=Cj0KCQiA-gclid-123",
  referrer: "https://www.google.com/",
  visits: 2,
  video_max_pct: 75,
  faq_questions: ["Qual o valor da entrada?"],
  temperature: "quente",
};

const S1 = "2026-11-17T00:02:00Z"; // 16/11 21:02 SP
const S2 = "2026-11-18T13:00:00Z"; // 18/11 10:00 SP
const at = (base, sec) => new Date(Date.parse(base) + sec * 1000).toISOString();
const e1 = (sec, type, props = {}, extra = {}) => ({
  occurred_at: at(S1, sec), session_id: "sess-1", session_started_at: S1, device: "mobile", type, name: null, section: null, props, ...extra,
});
const e2 = (sec, type, props = {}, extra = {}) => ({
  occurred_at: at(S2, sec), session_id: "sess-2", session_started_at: S2, device: "desktop", type, name: null, section: null, props, ...extra,
});
const EVENTS = [
  e1(0, "page_view", { path: "/" }),
  e1(5, "video", { video: "hero" }, { name: "play" }),
  e1(30, "video", { video: "hero", pct: 25 }, { name: "progress" }),
  e1(60, "video", { video: "hero", pct: 75 }, { name: "progress" }),
  e1(70, "section_view", { seconds: 70 }, { section: "top" }),
  e1(120, "faq_open", { question: "Qual o valor da entrada?" }, { section: "faq" }),
  e1(150, "section_view", { seconds: 42 }, { section: "faq" }),
  e1(360, "lead_submitted", { form_id: "form-lead", lead_token: "tok-secret-123", ip_hash: "hash-secret-456" }),
  e1(390, "thank_you_view", {}),
  e2(0, "page_view", { path: "/" }),
  e2(240, "cta_click", { label: "hero-cta-visit", x: 10, y: 20 }),
];

let leadResult, eventsResult;
function defaultRespond(q) {
  if (q.table === "panel_leads") return leadResult;
  if (q.table === "panel_lead_events") return eventsResult;
  return { data: null, error: new Error("unexpected table") };
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
    root.render(<QueryClientProvider client={client}><LeadPage /></QueryClientProvider>);
  });
  await flush();
}
beforeEach(() => {
  mockParams = { id: ID };
  mockQueries.length = 0;
  leadResult = { data: LEAD, error: null };
  eventsResult = { data: EVENTS, error: null };
  mockRespond = defaultRespond;
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  client.clear();
});

const $ = (sel) => container.querySelector(sel);
const $$ = (sel) => [...container.querySelectorAll(sel)];
const text = () => container.textContent;
const has = (q, ...call) => q.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));

test("queries the lead by id (single row) and its events ordered by time, capped at 2000", async () => {
  await mount();
  const lead = mockQueries.find((q) => q.table === "panel_leads");
  expect(has(lead, "eq", "id", ID)).toBe(true);
  expect(lead.calls.some((c) => c[0] === "maybeSingle")).toBe(true);
  const evs = mockQueries.find((q) => q.table === "panel_lead_events");
  expect(has(evs, "eq", "lead_id", ID)).toBe(true);
  expect(has(evs, "order", "occurred_at", { ascending: true })).toBe(true);
  expect(has(evs, "limit", 2000)).toBe(true);
});

test("header: name, formatted phone with wa.me link, e-mail, temperature, back link", async () => {
  await mount();
  expect($("h1").textContent).toBe("Ana Souza");
  expect(text()).toContain("(11) 94038-3680");
  const wa = $$("a").find((a) => (a.getAttribute("href") || "").startsWith("https://wa.me/"));
  expect(wa.getAttribute("href")).toBe("https://wa.me/5511940383680");
  expect(wa.getAttribute("target")).toBe("_blank");
  expect($("a[href='mailto:ana@example.com']")).not.toBeNull();
  expect(text()).toContain("Quente");
  expect($("a[href='/painel']")).not.toBeNull();
});

test("milestones: done ones with time, pending greyed, no RD confirmation", async () => {
  await mount();
  const list = $("[aria-label='Marcos do lead']");
  const items = [...list.querySelectorAll("li")];
  expect(items.map((li) => li.getAttribute("data-done"))).toEqual(["true", "true", "false"]);
  expect(items[0].textContent).toContain("Enviou formulário");
  expect(items[0].textContent).toContain("16/11 21:08");
  expect(items[1].textContent).toContain("Página de obrigado");
  expect(items[2].textContent).toContain("Foi ao WhatsApp");
  expect(items[2].textContent).toContain("Ainda não");
  expect(list.textContent).not.toMatch(/Confirmado/);
});

test("summary: time on page, max video, FAQ questions, visits and first origin", async () => {
  await mount();
  const s = $("[aria-label='Resumo']");
  expect(s.textContent).toContain("1 min 52 s"); // 70 s + 42 s
  expect(s.textContent).toContain("75%");
  expect(s.textContent).toContain("2 visitas");
  expect(s.textContent).toContain("Google Ads");
  expect(s.textContent).toContain("Qual o valor da entrada?");
});

test("origin card: badge, campaign, keyword, gclid with copy button, device, landing path, referrer host", async () => {
  await mount();
  const o = $("[aria-label='Origem']");
  expect(o.textContent).toContain("Google Ads");
  expect(o.textContent).toContain("lancamento-sp");
  expect(o.textContent).toContain("apartamento zona sul");
  expect(o.textContent).toContain("Cj0KCQiA-gclid-123");
  expect(o.textContent).toContain("Celular");
  expect(o.textContent).toContain("www.google.com");
  expect(o.querySelector("[data-field='landing']").textContent).toBe("/");

  const writeText = jest.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const copy = [...o.querySelectorAll("button")].find((b) => /copiar/i.test(b.getAttribute("aria-label") || ""));
  await act(async () => { copy.click(); });
  await flush();
  expect(writeText).toHaveBeenCalledWith("Cj0KCQiA-gclid-123");
  expect(o.textContent).toContain("Copiado");
});

test("timeline grouped by visit with headers, Portuguese labels and collapsed video progress", async () => {
  await mount();
  const visits = $$("[data-visit]");
  expect(visits).toHaveLength(2);
  const h1 = visits[0].querySelector("h3").textContent;
  expect(h1).toContain("Visita 1");
  expect(visits[0].textContent).toContain("16/11 21:02");
  expect(visits[0].textContent).toContain("celular");
  expect(visits[0].textContent).toContain("6 min");
  expect(visits[1].querySelector("h3").textContent).toContain("Visita 2");
  expect(visits[1].textContent).toContain("18/11 10:00");
  expect(visits[1].textContent).toContain("computador");
  expect(visits[1].textContent).toContain("4 min");

  const v1 = visits[0].textContent;
  expect(v1).toContain("Entrou na página");
  expect(v1).toContain("Deu play no vídeo");
  expect(v1).toContain("Assistiu até 75% do vídeo");
  expect(v1).not.toContain("25% do vídeo");
  expect(v1).toContain("Abriu a dúvida: Qual o valor da entrada?");
  expect(v1).toContain("Enviou o formulário");
  expect(v1).toContain("Chegou na página de obrigado");
  expect(visits[1].textContent).toContain("Clicou em “Agendar visita”");

  // each event row shows its time (SP)
  expect(v1).toContain("21:08");
  // milestones in the timeline are flagged
  const milestoneRows = $$("[data-milestone='true']");
  expect(milestoneRows.map((r) => r.textContent).join(" ")).toMatch(/Enviou o formulário[\s\S]*Chegou na página de obrigado/);
});

test("never renders lead_token, ip_hash or raw JSON", async () => {
  await mount();
  expect(container.innerHTML).not.toMatch(/tok-secret-123|hash-secret-456/);
  expect(text()).not.toMatch(/[{}]/);
});

test("lead not found -> friendly message and back link", async () => {
  leadResult = { data: null, error: null };
  await mount();
  expect(text()).toContain("Lead não encontrado");
  expect($("a[href='/painel']")).not.toBeNull();
  expect($("[data-visit]")).toBeNull();
});

test("invalid id -> not found without querying", async () => {
  mockParams = { id: "nao-e-um-uuid" };
  await mount();
  expect(text()).toContain("Lead não encontrado");
  expect(mockQueries).toHaveLength(0);
});

test("lead without events -> empty timeline state, summary still shown", async () => {
  eventsResult = { data: [], error: null };
  await mount();
  expect($("h1").textContent).toBe("Ana Souza");
  expect(text()).toContain("Nenhum passo registrado");
  expect($("[aria-label='Resumo']").textContent).toContain("75%");
});

test("load error -> alert with retry", async () => {
  leadResult = { data: null, error: new Error("boom") };
  await mount();
  const alert = $("[role='alert']");
  expect(alert.textContent).toContain("Não foi possível carregar este lead");
  const retry = [...alert.querySelectorAll("button")].find((b) => b.textContent.includes("Tentar de novo"));
  leadResult = { data: LEAD, error: null };
  await act(async () => { retry.click(); });
  await flush();
  expect($("h1").textContent).toBe("Ana Souza");
});

test("events error -> lead shown, timeline shows an error with retry", async () => {
  eventsResult = { data: null, error: new Error("boom") };
  await mount();
  expect($("h1").textContent).toBe("Ana Souza");
  expect(text()).toContain("Não foi possível carregar a linha do tempo");
});

test("loading state while the lead is pending", async () => {
  mockRespond = () => new Promise(() => {});
  await mount();
  expect($("[aria-busy='true']")).not.toBeNull();
  expect(text()).toContain("Carregando");
});
