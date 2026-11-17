import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockPath = "/painel";
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  Outlet: () => <div data-testid="outlet" />,
  useLocation: () => ({ pathname: mockPath }),
  useNavigate: () => mockNavigate,
}), { virtual: true });

const mockSignOut = jest.fn(() => Promise.resolve());
jest.mock("../auth", () => ({ signOut: (...a) => mockSignOut(...a) }));
jest.mock("../RequireAdmin", () => ({ useAdminUser: () => ({ email: "dono@x.com" }) }));

const Layout = require("../Layout").default;
const { EnvProvider, useEnv } = require("../EnvContext");

let root, container, envApi;
function EnvProbe() { envApi = useEnv(); return null; }
async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<EnvProvider><Layout /><EnvProbe /></EnvProvider>); });
}
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});
beforeEach(() => { sessionStorage.clear(); mockPath = "/painel"; mockNavigate.mockReset(); mockSignOut.mockClear(); });

const nav = () => container.querySelector('nav[aria-label="Painel"]');

test("sidebar has the three sections and the outlet", async () => {
  await mount();
  const links = [...nav().querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
  expect(links).toEqual([["Leads", "/painel"], ["Funil & Campanhas", "/painel/funil"], ["Ao vivo", "/painel/ao-vivo"]]);
  expect(container.querySelector('[data-testid="outlet"]')).not.toBeNull();
});

test("a lead page keeps Leads marked as current", async () => {
  mockPath = "/painel/leads/42";
  await mount();
  expect(nav().querySelector('[aria-current="page"]').textContent).toBe("Leads");
});

test("environment switch defaults to production and changes the context", async () => {
  await mount();
  const radios = [...container.querySelectorAll('[role="radio"]')];
  expect(radios.map((r) => [r.textContent, r.getAttribute("aria-checked")])).toEqual([["Produção", "true"], ["Teste", "false"]]);
  await act(async () => { radios[1].click(); });
  expect(envApi.env).toBe("staging");
});

test("mobile menu opens and closes with Escape", async () => {
  await mount();
  await act(async () => { container.querySelector('[aria-label="Abrir menu"]').click(); });
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test("Sair signs out everywhere (global) and goes to /login", async () => {
  await mount();
  const sair = [...container.querySelectorAll("button")].find((b) => b.textContent === "Sair");
  await act(async () => { sair.click(); });
  expect(mockSignOut).toHaveBeenCalledWith("global");
  expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
});

test("phone top bar names the section; a lead page shows a way back to Leads instead", async () => {
  await mount();
  expect(container.querySelector("header").textContent).toContain("Leads");
  expect(container.querySelector('[aria-label="Voltar para Leads"]')).toBeNull();
  await act(async () => { root.unmount(); });
  container.remove();
  mockPath = "/painel/leads/42";
  await mount();
  const back = container.querySelector('[aria-label="Voltar para Leads"]');
  expect(back.getAttribute("href")).toBe("/painel");
});

test("open menu locks page scroll; closing restores it", async () => {
  await mount();
  await act(async () => { container.querySelector('[aria-label="Abrir menu"]').click(); });
  expect(document.body.style.overflow).toBe("hidden");
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
  expect(document.body.style.overflow).toBe("");
});

// Minimal matchMedia fake: fireMedia(query, true) simulates the viewport reaching the query.
const mockMql = {};
function installMatchMedia() {
  window.matchMedia = (query) => {
    mockMql[query] = mockMql[query] || { matches: false, listeners: [] };
    const m = mockMql[query];
    return {
      get matches() { return m.matches; },
      addEventListener: (_, fn) => m.listeners.push(fn),
      removeEventListener: (_, fn) => { m.listeners = m.listeners.filter((l) => l !== fn); },
    };
  };
}
function fireMedia(query, matches) {
  mockMql[query].matches = matches;
  mockMql[query].listeners.slice().forEach((fn) => fn({ matches }));
}
const tabKey = (shiftKey = false) => act(async () => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }));
});

describe("drawer as a modal", () => {
  beforeEach(installMatchMedia);
  afterEach(() => { delete window.matchMedia; Object.keys(mockMql).forEach((k) => delete mockMql[k]); });

  test("drawer closes and unlocks scroll when the viewport reaches desktop (1024px)", async () => {
    await mount();
    await act(async () => { container.querySelector('[aria-label="Abrir menu"]').click(); });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => { fireMedia("(min-width: 1024px)", true); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  test("focus moves into the drawer, Tab stays inside, and returns to the menu button on close", async () => {
    await mount();
    const menu = container.querySelector('[aria-label="Abrir menu"]');
    menu.focus();
    await act(async () => { menu.click(); });
    const panel = container.querySelector('[role="dialog"] aside');
    expect(panel.contains(document.activeElement)).toBe(true);
    const items = [...panel.querySelectorAll("a[href],button:not([disabled])")];
    items[items.length - 1].focus();
    await tabKey();
    expect(document.activeElement).toBe(items[0]);
    await tabKey(true);
    expect(document.activeElement).toBe(items[items.length - 1]);
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(document.activeElement).toBe(menu);
  });
});
