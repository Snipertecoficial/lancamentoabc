import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

const AdsManager = require("../pages/AdsManager").default;
const { parseBudget, commandText } = require("../pages/AdsManager");

let campaigns, keywords, commands, insertError;
function respond(q) {
  if (q.calls.some((c) => c[0] === "insert" || c[0] === "update")) return { data: null, error: insertError };
  if (q.table === "ads_campaigns") return { data: campaigns, error: null };
  if (q.table === "ads_keywords") return { data: keywords, error: null };
  if (q.table === "ads_commands") return { data: commands, error: null };
  return { data: [], error: null };
}

let root, container;
async function flush() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<QueryClientProvider client={client}><AdsManager /></QueryClientProvider>); });
  await flush();
}
const text = () => container.textContent.replace(/ /g, " ");
const buttons = (label) => [...container.querySelectorAll("button")].filter((b) => b.textContent.trim() === label);
const writes = () => mockQueries.filter((q) => q.calls.some((c) => c[0] === "insert" || c[0] === "update"));
async function click(el) { await act(async () => { el.click(); }); await flush(); }
function type(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function submit(form) { await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); await flush(); }

beforeEach(() => {
  mockQueries.length = 0;
  insertError = null;
  campaigns = [
    { campaign_id: "222", campaign_name: "PMax Espontone", status: "PAUSED", channel: "PERFORMANCE_MAX", budget_micros: 30000000, budget_shared: false, synced_at: new Date(Date.now() - 5 * 60000).toISOString() },
    { campaign_id: "111", campaign_name: "SBC Pesquisa", status: "ENABLED", channel: "SEARCH", budget_micros: 100000000, budget_shared: true, synced_at: new Date(Date.now() - 5 * 60000).toISOString() },
  ];
  keywords = [{ campaign_id: "111", ad_group_id: "901", ad_group_name: "Apartamentos", criterion_id: "7001", keyword_text: "apartamento sbc", match_type: "PHRASE", status: "ENABLED" }];
  commands = [];
  mockRespond = respond;
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

test("lista campanhas ativas primeiro, com tipo, orcamento e situacao", async () => {
  await mount();
  const rows = [...container.querySelectorAll('[aria-label="Campanhas do Google Ads"] > li')].map((li) => li.textContent.replace(/ /g, " "));
  expect(rows[0]).toContain("SBC Pesquisa");
  expect(rows[0]).toContain("Pesquisa · R$ 100,00/dia · orçamento compartilhado");
  expect(rows[0]).toContain("Ativa");
  expect(rows[0]).toContain("Pausar");
  expect(rows[1]).toContain("PMax Espontone");
  expect(rows[1]).toContain("Pausada");
  expect(rows[1]).toContain("Ativar");
  expect(text()).toContain("Situação lida do Google Ads há 5 min");
});

test("sem campanhas sincronizadas pede o script versao 2", async () => {
  campaigns = [];
  await mount();
  expect(text()).toContain("cole a versão 2 do script do Radar");
});

test("pausar campanha confirma e grava o pedido na fila", async () => {
  await mount();
  await click(buttons("Pausar")[0]);
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Pausar a campanha "SBC Pesquisa"?'));
  const [w] = writes();
  expect(w.table).toBe("ads_commands");
  expect(w.calls[0]).toEqual(["insert", { kind: "campaign_status", campaign_id: "111", value: { status: "PAUSED" }, previous: { status: "ENABLED", campaign_name: "SBC Pesquisa" } }]);
});

test("sem confirmar nada e enviado", async () => {
  window.confirm.mockReturnValue(false);
  await mount();
  await click(buttons("Ativar")[0]);
  expect(writes()).toHaveLength(0);
});

test("orcamento: valor valido vira micros; valor invalido mostra erro e nao envia", async () => {
  await mount();
  await click(buttons("Orçamento")[0]);
  const form = container.querySelector('form[aria-label="Orçamento de SBC Pesquisa"]');
  type(form.querySelector("input"), "0");
  await submit(form);
  expect(text()).toContain("Digite um valor entre R$ 1 e R$ 10.000");
  expect(writes()).toHaveLength(0);

  type(form.querySelector("input"), "250");
  await submit(form);
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("mais de 50%"));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("compartilhado"));
  expect(writes()[0].calls[0]).toEqual(["insert", { kind: "campaign_budget", campaign_id: "111", value: { amount_micros: 250000000 }, previous: { amount_micros: 100000000, campaign_name: "SBC Pesquisa" } }]);
});

test("palavras-chave: pausar uma e adicionar negativa", async () => {
  await mount();
  await click(buttons("Palavras-chave (1)")[0]);
  const list = container.querySelector('[aria-label="Palavras-chave de SBC Pesquisa"]');
  expect(list.textContent).toContain("apartamento sbc");
  await click([...list.querySelectorAll("button")].find((b) => b.textContent === "Pausar"));
  expect(writes()[0].calls[0]).toEqual(["insert", {
    kind: "keyword_status", campaign_id: "111", ad_group_id: "901", criterion_id: "7001", value: { status: "PAUSED" },
    previous: { status: "ENABLED", keyword_text: "apartamento sbc", campaign_name: "SBC Pesquisa" },
  }]);

  const form = container.querySelector('form[aria-label="Palavra-chave negativa em SBC Pesquisa"]');
  type(form.querySelector("input"), "  aluguel ");
  type(form.querySelector("select"), "EXACT");
  await submit(form);
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Adicionar "aluguel" como palavra-chave negativa (exata)'));
  expect(writes()[1].calls[0]).toEqual(["insert", { kind: "campaign_negative", campaign_id: "111", value: { text: "aluguel", match_type: "EXACT" }, previous: { campaign_name: "SBC Pesquisa" } }]);
});

test("pedido em aberto troca o botao por aguardando; pode cancelar enquanto aguarda", async () => {
  commands = [
    { id: 12, kind: "campaign_status", campaign_id: "111", value: { status: "PAUSED" }, previous: { campaign_name: "SBC Pesquisa" }, status: "pending", error: null, created_at: new Date().toISOString() },
    { id: 11, kind: "campaign_budget", campaign_id: "222", value: { amount_micros: 50000000 }, previous: { amount_micros: 30000000, campaign_name: "PMax Espontone" }, status: "failed", error: "BUDGET_TOO_LOW", created_at: new Date().toISOString() },
  ];
  await mount();
  expect(buttons("Pausar")).toHaveLength(0);
  expect(text()).toContain("Pausando: aguardando o google ads");
  const changes = container.querySelector('[aria-label="Alterações enviadas"]').textContent.replace(/ /g, " ");
  expect(changes).toContain('Pausar "SBC Pesquisa"');
  expect(changes).toContain('Orçamento de "PMax Espontone": R$ 30,00 → R$ 50,00 por dia');
  expect(changes).toContain("BUDGET_TOO_LOW");
  expect(changes).toContain("Falhou");

  await click(buttons("Cancelar")[0]);
  const [w] = writes();
  expect(w.calls).toEqual([["update", { status: "canceled" }], ["eq", "id", 12], ["eq", "status", "pending"]]);
});

test("erro ao gravar mostra aviso", async () => {
  insertError = { message: "denied" };
  await mount();
  await click(buttons("Pausar")[0]);
  expect(container.querySelector('[role="alert"]').textContent).toContain("Não foi possível enviar a alteração");
});

test("parseBudget entende formatos brasileiros e limita o valor", () => {
  expect(parseBudget("150")).toBe(150000000);
  expect(parseBudget("150,5")).toBe(150500000);
  expect(parseBudget("R$ 1.200,00")).toBe(1200000000);
  expect(parseBudget("1.200")).toBe(1200000000);
  expect(parseBudget("150.50")).toBe(150500000);
  expect(parseBudget("0,99")).toBeNull();
  expect(parseBudget("10000,01")).toBeNull();
  expect(parseBudget("abc")).toBeNull();
});

test("commandText descreve cada tipo de pedido", () => {
  expect(commandText({ kind: "campaign_negative", campaign_id: "1", value: { text: "aluguel", match_type: "PHRASE" }, previous: { campaign_name: "X" } }))
    .toBe('Negativa "aluguel" (frase) em "X"');
  expect(commandText({ kind: "keyword_status", campaign_id: "1", criterion_id: "9", value: { status: "ENABLED" }, previous: {} }))
    .toBe('Ativar a palavra-chave "9" em campanha 1');
});
