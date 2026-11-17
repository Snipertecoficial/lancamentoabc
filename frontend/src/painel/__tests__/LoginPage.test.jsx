import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
  Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });

let mockSession;
const mockSignIn = jest.fn();
jest.mock("../auth", () => ({
  useAdminSession: () => mockSession,
  signIn: (...a) => mockSignIn(...a),
}));

const LoginPage = require("../LoginPage").default;

let root, container;
async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<LoginPage />); });
}
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});
beforeEach(() => {
  mockSession = { status: "anon", user: null };
  mockNavigate.mockReset();
  mockSignIn.mockReset();
});

const setValue = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
async function submit(email, password) {
  await act(async () => {
    setValue(container.querySelector('input[type="email"]'), email);
    setValue(container.querySelector('input[name="password"]'), password);
  });
  await act(async () => {
    container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

test("already admin -> goes straight to /painel", async () => {
  mockSession = { status: "admin", user: {} };
  await mount();
  expect(container.querySelector('[data-testid="navigate"]').getAttribute("data-to")).toBe("/painel");
});

test("no sign-up and no password reset", async () => {
  await mount();
  expect(container.textContent).not.toMatch(/cadastr|esqueci/i);
});

test("successful sign in -> navigates to /painel", async () => {
  mockSignIn.mockResolvedValue({ ok: true });
  await mount();
  await submit("dono@x.com", "segredo");
  expect(mockSignIn).toHaveBeenCalledWith("dono@x.com", "segredo");
  expect(mockNavigate).toHaveBeenCalledWith("/painel", { replace: true });
});

test("failed sign in -> shows the error, stays on the page", async () => {
  mockSignIn.mockResolvedValue({ ok: false, error: "E-mail ou senha incorretos." });
  await mount();
  await submit("dono@x.com", "errada");
  expect(container.querySelector('[role="alert"]').textContent).toBe("E-mail ou senha incorretos.");
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("tab title is 'Radar — Painel' on /login, restored on the way out", async () => {
  document.title = "Apartamentos à venda no ABC";
  await mount();
  expect(document.title).toBe("Radar — Painel");
  await act(async () => { root.unmount(); });
  expect(document.title).toBe("Apartamentos à venda no ABC");
  root = createRoot(container); // afterEach unmounts again
});
