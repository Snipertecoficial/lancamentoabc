import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  useNavigate: () => jest.fn(),
}), { virtual: true });

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

const AnunciosPage = require("../pages/AnunciosPage").default;
const { EnvProvider } = require("../EnvContext");
const { periodRange } = require("../lib/period");

const has = (q, ...call) => q.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));
const last = (table) => mockQueries.filter((q) => q.table === table).slice(-1)[0];
const text = () => container.textContent.replace(/ /g, " ");

let syncRows, campaignRows, keywordRows, campaignError, firstDayRows;
function defaultRespond(q) {
  if (q.table === "ads_sync_runs") return { data: syncRows, error: null };
  if (q.table === "ads_campaign_daily") return { data: firstDayRows, error: null };
  if (q.table === "panel_ads_campaigns_daily") return campaignError ? { data: null, error: campaignError } : { data: campaignRows, error: null };
  if (q.table === "panel_ads_keywords_daily") return { data: keywordRows, error: null };
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
    root.render(<QueryClientProvider client={client}><EnvProvider><AnunciosPage /></EnvProvider></QueryClientProvider>);
  });
  await flush();
}

const r30 = periodRange({ period: "30d" });
beforeEach(() => {
  sessionStorage.clear();
  mockQueries.length = 0;
  campaignError = null;
  syncRows = [{ received_at: new Date(Date.now() - 20 * 60000).toISOString(), customer_id: "1234567890", currency: "BRL" }];
  campaignRows = [
    { day: r30.fromDay, campaign_id: "111", campaign_name: "SBC Pesquisa", channel: "SEARCH", impressions: 1000, clicks: 50, cost: "100", google_conversions: "2", leads: 2 },
    { day: r30.toDay, campaign_id: "111", campaign_name: "SBC Pesquisa", channel: "SEARCH", impressions: 1000, clicks: 50, cost: "100", google_conversions: "1", leads: 2 },
    { day: r30.toDay, campaign_id: "222", campaign_name: "PMax Espontone", channel: "PERFORMANCE_MAX", impressions: 500, clicks: 10, cost: "50", google_conversions: "0", leads: 0 },
  ];
  keywordRows = [
    { day: r30.toDay, campaign_id: "111", campaign_name: "SBC Pesquisa", ad_group_id: "901", criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE", impressions: 600, clicks: 30, cost: "60", google_conversions: "1", leads: 3 },
    { day: r30.toDay, campaign_id: "111", campaign_name: "SBC Pesquisa", ad_group_id: null, criterion_id: null, keyword_text: null, match_type: null, impressions: 0, clicks: 0, cost: "0", google_conversions: "0", leads: 1 },
  ];
  firstDayRows = [];
  mockRespond = defaultRespond;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test("busca as views de anuncios no periodo (30 dias por padrao), sem filtro de ambiente", async () => {
  await mount();
  const c = last("panel_ads_campaigns_daily");
  expect(has(c, "gte", "day", r30.fromDay)).toBe(true);
  expect(has(c, "lte", "day", r30.toDay)).toBe(true);
  expect(c.calls.some((call) => call[0] === "eq" && call[1] === "env")).toBe(false);
  expect(last("panel_ads_keywords_daily")).toBeTruthy();
});

test("resumo: investimento, leads e custo por lead somados no periodo", async () => {
  await mount();
  const kpis = container.querySelector('[aria-label="Resumo do período"]').textContent.replace(/ /g, " ");
  expect(kpis).toContain("R$ 250,00");
  expect(kpis).toContain("Investimento");
  expect(kpis).toMatch(/4\s*Leads do Radar/);
  expect(kpis).toContain("R$ 62,50"); // 250 / 4
  expect(kpis).toContain("CPC médio");
  expect(kpis).toContain("R$ 2,27"); // 250 / 110
});

test("tabela de campanhas com custo por lead, a de maior investimento primeiro; sem lead mostra traco", async () => {
  await mount();
  const rows = [...container.querySelectorAll('[aria-label="Campanhas"] tbody tr')].map((tr) => tr.textContent.replace(/ /g, " "));
  expect(rows).toHaveLength(2);
  expect(rows[0]).toContain("SBC Pesquisa");
  expect(rows[0]).toContain("R$ 200,00");
  expect(rows[0]).toContain("R$ 50,00");
  expect(rows[1]).toContain("PMax Espontone");
  expect(rows[1]).toContain("—");
});

test("palavras-chave com tipo de correspondencia e linha de leads sem palavra-chave", async () => {
  await mount();
  const rows = [...container.querySelectorAll('[aria-label="Palavras-chave"] tbody tr')].map((tr) => tr.textContent.replace(/ /g, " "));
  expect(rows[0]).toContain("apartamento sbc");
  expect(rows[0]).toContain("frase");
  expect(rows[0]).toContain("R$ 20,00");
  expect(rows[1]).toContain("Palavra-chave não identificada");
  expect(rows[1]).toContain("sem custo");
});

test("avisa quando a conta do Google Ads usa outro fuso", async () => {
  syncRows[0].time_zone = "America/New_York";
  await mount();
  expect(text()).toContain("usa o fuso America/New_York");
});

test("mostra quando o Google Ads foi atualizado", async () => {
  await mount();
  expect(text()).toContain("Google Ads atualizado há 20 min");
});

test("sem nenhuma sincronizacao: passo a passo para conectar, sem tabelas", async () => {
  syncRows = [];
  await mount();
  expect(text()).toContain("O Google Ads ainda não enviou dados.");
  expect(text()).toContain("RADAR_ADS_SECRET");
  expect(container.querySelector('[aria-label="Campanhas"]')).toBeNull();
});

test("erro ao carregar campanhas mostra tentar de novo", async () => {
  campaignError = { message: "boom" };
  await mount();
  const panel = container.querySelector('[aria-label="Campanhas"]');
  expect(panel.textContent).toContain("Não foi possível carregar as campanhas.");
  expect(panel.textContent).toContain("Tentar de novo");
});

test("em dados de teste avisa que a tela mostra producao", async () => {
  sessionStorage.setItem("radar-painel-env", "staging");
  await mount();
  expect(text()).toContain("Esta tela sempre mostra produção.");
});

const br = (ymd) => ymd.split("-").reverse().join("/");
function typeDate(label, value) {
  const input = container.querySelector(`input[aria-label="${label}"]`);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const button = (label) => [...container.querySelectorAll("button")].find((b) => b.textContent.trim() === label);

test("datas personalizadas so buscam ao clicar em Aplicar", async () => {
  await mount();
  await act(async () => { container.querySelector('[role="radio"][aria-checked="false"]:last-child').click(); });
  await flush();
  expect(button("Aplicar").disabled).toBe(true);

  typeDate("De", "2026-10-01");
  typeDate("Até", "2026-10-10");
  await flush();
  expect(has(last("panel_ads_campaigns_daily"), "gte", "day", "2026-10-01")).toBe(false);

  expect(button("Aplicar").disabled).toBe(false);
  await act(async () => { button("Aplicar").click(); });
  await flush();
  const c = last("panel_ads_campaigns_daily");
  expect(has(c, "gte", "day", "2026-10-01")).toBe(true);
  expect(has(c, "lte", "day", "2026-10-10")).toBe(true);
  expect(button("Aplicar").disabled).toBe(true);
});

test("Aplicar fica desligado com data inicial depois da final", async () => {
  await mount();
  await act(async () => { container.querySelector('[role="radio"][aria-checked="false"]:last-child').click(); });
  await flush();
  typeDate("De", "2026-10-20");
  typeDate("Até", "2026-10-10");
  expect(button("Aplicar").disabled).toBe(true);
});

test("mostra as datas exatas do periodo para comparar com o Google", async () => {
  await mount();
  expect(text()).toContain(`Últimos 30 dias (${br(r30.fromDay)} a ${br(r30.toDay)})`);
  expect(text()).toContain("não inclui hoje");
});

test("avisa quando o periodo comeca antes dos dados enviados pelo Google Ads", async () => {
  firstDayRows = [{ day: r30.toDay }];
  await mount();
  expect(text()).toContain(`O Google Ads enviou custos a partir de ${br(r30.toDay)}`);
});

test("sem aviso de historico quando o periodo esta coberto", async () => {
  firstDayRows = [{ day: r30.fromDay }];
  await mount();
  expect(text()).not.toContain("O Google Ads enviou custos a partir de");
});
