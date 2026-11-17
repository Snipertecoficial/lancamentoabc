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
jest.mock("../auth", () => ({ signOut: () => mockSignOut() }));
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

test("Sair signs out and goes to /login", async () => {
  await mount();
  const sair = [...container.querySelectorAll("button")].find((b) => b.textContent === "Sair");
  await act(async () => { sair.click(); });
  expect(mockSignOut).toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
});
