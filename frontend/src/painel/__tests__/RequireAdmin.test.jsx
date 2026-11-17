import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// react-router-dom v7 ships only an "exports" map, which this Jest (27) cannot resolve.
jest.mock("react-router-dom", () => ({
  Navigate: ({ to, replace }) => <div data-testid="navigate" data-to={to} data-replace={String(!!replace)} />,
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  useLocation: () => ({ pathname: "/painel/funil" }),
}), { virtual: true });

let mockSession;
jest.mock("../auth", () => ({ useAdminSession: () => mockSession }));

const RequireAdmin = require("../RequireAdmin").default;
const { useAdminUser } = require("../RequireAdmin");

let root, container;
async function mount(node) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(node); });
}
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

function Secret() {
  const user = useAdminUser();
  return <p data-testid="secret">dados de {user && user.email}</p>;
}
const tree = <RequireAdmin><Secret /></RequireAdmin>;

test("loading -> skeleton, no children", async () => {
  mockSession = { status: "loading", user: null };
  await mount(tree);
  expect(container.querySelector('[data-testid="painel-loading"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="secret"]')).toBeNull();
});

test("anon -> redirects to /login, no children", async () => {
  mockSession = { status: "anon", user: null };
  await mount(tree);
  const nav = container.querySelector('[data-testid="navigate"]');
  expect(nav.getAttribute("data-to")).toBe("/login");
  expect(nav.getAttribute("data-replace")).toBe("true");
  expect(container.querySelector('[data-testid="secret"]')).toBeNull();
});

test("denied -> 'Acesso não autorizado', no children", async () => {
  mockSession = { status: "denied", user: null };
  await mount(tree);
  expect(container.textContent).toContain("Acesso não autorizado");
  expect(container.querySelector('[data-testid="secret"]')).toBeNull();
  expect(container.querySelector('a[href="/login"]')).not.toBeNull();
});

test("admin -> children with the user in context", async () => {
  mockSession = { status: "admin", user: { email: "dono@x.com" } };
  await mount(tree);
  expect(container.querySelector('[data-testid="secret"]').textContent).toBe("dados de dono@x.com");
});
