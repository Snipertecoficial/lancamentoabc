import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  useNavigate: () => jest.fn(),
}), { virtual: true });

// Records the options every useQuery call receives, so the polling setup can be checked.
const mockQueryOptions = [];
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return { ...actual, useQuery: (o) => { mockQueryOptions.push(o); return actual.useQuery(o); } };
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

const AoVivoPage = require("../pages/AoVivoPage").default;
const { EnvProvider } = require("../EnvContext");

const has = (q, ...call) => q.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));
const MIN = 60000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

let sessions, liveError;
beforeEach(() => {
  sessionStorage.clear();
  mockQueries.length = 0;
  mockQueryOptions.length = 0;
  liveError = null;
  sessions = [
    {
      id: "s-ads", started_at: ago(12 * MIN), last_event_at: ago(2 * MIN),
      landing_url: "https://lancamento.espontone.com.br/?gclid=SECRET-GCLID-123&utm_source=google",
      origin: "google_ads", referrer_host: null, utm_source: "google", utm_campaign: "sbc-search", keyword: "apartamento sbc", device: "mobile",
      lead_id: "11111111-1111-1111-1111-111111111111", current_section: "faq",
    },
    {
      id: "s-direct", started_at: ago(30 * 1000), last_event_at: ago(10 * 1000),
      landing_url: "https://lancamento.espontone.com.br/", origin: "organic_search", referrer_host: "www.google.com.br", utm_source: null, utm_campaign: null, keyword: null,
      device: "desktop", lead_id: null, current_section: "galeria3d",
    },
  ];
  mockRespond = (q) => (liveError ? { data: null, error: liveError } : { data: sessions, error: null });
});

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
    root.render(<QueryClientProvider client={client}><EnvProvider><AoVivoPage /></EnvProvider></QueryClientProvider>);
  });
  await flush();
}
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  client.clear();
});

const $ = (sel) => container.querySelector(sel);
const $$ = (sel) => [...container.querySelectorAll(sel)];

test("polls every 10 s only while the tab is visible", async () => {
  await mount();
  const live = mockQueryOptions.find((o) => o.queryKey[0] === "panel_sessions_live");
  expect(live.refetchInterval).toBe(10000);
  expect(live.refetchIntervalInBackground).toBe(false);
});

test("query: panel_sessions_live by env, newest activity first, no raw props or hashes", async () => {
  await mount();
  const q = mockQueries.find((x) => x.table === "panel_sessions_live");
  expect(has(q, "eq", "env", "production")).toBe(true);
  expect(has(q, "order", "last_event_at", { ascending: false })).toBe(true);
  expect(q.calls[0][0]).toBe("select");
  expect(q.calls[0][1]).not.toMatch(/\*|ip_hash|props|landing_url/);
  expect(q.calls[0][1].split(",")).toEqual(expect.arrayContaining(["origin", "referrer_host", "lead_id", "current_section"]));
});

test("staging environment is used", async () => {
  sessionStorage.setItem("radar-painel-env", "staging");
  await mount();
  expect(has(mockQueries.find((x) => x.table === "panel_sessions_live"), "eq", "env", "staging")).toBe(true);
});

test("header counts people on the site now", async () => {
  await mount();
  expect($("h1").textContent).toBe("2 pessoas no site agora");
  sessions = sessions.slice(0, 1);
  await act(async () => { await client.refetchQueries(); });
  await flush();
  expect($("h1").textContent).toBe("1 pessoa no site agora");
});

test("cards: origin, campaign and keyword, device, section, times; never the click id", async () => {
  await mount();
  const cards = $$("ul[aria-label='Pessoas no site'] > li");
  expect(cards).toHaveLength(2);
  const ads = cards[0];
  expect(ads.textContent).toContain("Google Ads");
  expect(ads.textContent).toContain("sbc-search");
  expect(ads.textContent).toContain("apartamento sbc");
  expect(ads.textContent).toContain("Celular");
  expect(ads.textContent).toContain("Dúvidas");
  expect(ads.textContent).toContain("há 12 min");
  expect(ads.textContent).toContain("há 2 min");
  const direct = cards[1];
  expect(direct.textContent).toContain("Busca orgânica");
  expect(direct.textContent).toContain("www.google.com.br");
  expect(direct.textContent).not.toContain("Orgânico ou direto");
  expect(direct.textContent).toContain("Computador");
  expect(direct.textContent).toContain("Galeria");
  expect(direct.textContent).toContain("agora");
  expect(container.innerHTML).not.toContain("SECRET-GCLID-123");
  expect(container.innerHTML).not.toContain("lancamento.espontone.com.br");
});

test("a session that is already a lead links to the lead timeline", async () => {
  await mount();
  const chip = $('a[href="/painel/leads/11111111-1111-1111-1111-111111111111"]');
  expect(chip).not.toBeNull();
  expect(chip.textContent).toContain("Já é lead");
  expect($$("ul[aria-label='Pessoas no site'] > li")[1].querySelector("a")).toBeNull();
});

test("empty: nobody on the site, with the time of the last refresh", async () => {
  sessions = [];
  await mount();
  expect($("h1").textContent).toBe("Ninguém no site agora");
  expect(container.textContent).toMatch(/Atualizado às \d{2}:\d{2}:\d{2}/);
  expect($("ul[aria-label='Pessoas no site']")).toBeNull();
});

test("error shows a retry", async () => {
  liveError = { message: "boom" };
  await mount();
  expect($('[role="alert"]').textContent).toContain("Não foi possível ver quem está no site");
  liveError = null;
  await act(async () => { $$("button").find((b) => b.textContent.includes("Tentar de novo")).click(); });
  await flush();
  expect($("h1").textContent).toBe("2 pessoas no site agora");
});
