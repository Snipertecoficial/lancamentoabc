import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// react-router-dom v7 ships only an "exports" map, which this Jest (27) cannot resolve; a Link stub is enough.
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a> }), { virtual: true });

const PrivacyPage = require("../PrivacyPage").default;
const Footer = require("../Footer").default;
const CookieConsent = require("../CookieConsent").default;

let root, container;
async function mount(el) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
}
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  localStorage.clear();
  jest.useRealTimers();
});

test("PrivacyPage renders the key sections, controller data and contact e-mail", async () => {
  await mount(<PrivacyPage />);
  const text = container.textContent;
  [
    "Quem somos", "Dados que coletamos", "Cookies", "Para que usamos", "Bases legais",
    "Compartilhamento", "Por quanto tempo", "Seus direitos", "Escolhas sobre cookies",
    "Atualizações", "Última atualização: 17/11/2026", "Espontone Imóveis", "042656-J",
  ].forEach((s) => expect(text).toContain(s));
  expect(text).not.toContain("desativadas");
  expect(text).toContain("modo de consentimento, sem armazenar cookies ou identificadores");
  expect(text).toContain("sem identificador persistente");
  expect(text).toContain("quando ativado");
  expect(text).toContain("SHA-256");
  expect(text).not.toContain("não pode ser lido");
  expect(text).toContain("pseudonimizados");
  expect(text).toContain("não guardamos o seu IP em formato legível no nosso banco de dados");
  expect(text).toContain("até 13 meses");
  expect(text).toContain("em até 15 dias");
  expect(text).toContain("ANPD");
  expect(container.querySelector('a[href="mailto:contato@espontone.com.br"]')).not.toBeNull();
  expect(container.querySelector('a[href="/"]')).not.toBeNull();
  expect(document.title).toMatch(/Privacidade/);
});

test("footer privacy link points to /privacidade", async () => {
  await mount(<Footer />);
  const a = [...container.querySelectorAll("a")].find((x) => /Política de Privacidade/.test(x.textContent));
  expect(a.getAttribute("href")).toBe("/privacidade");
});

test("cookie banner links to /privacidade and drops the invalid implied-consent sentence", async () => {
  jest.useFakeTimers();
  await mount(<CookieConsent />);
  await act(async () => { jest.advanceTimersByTime(2500); });
  expect(container.textContent).not.toContain("Ao continuar navegando");
  expect(container.querySelector('a[href="/privacidade"]')).not.toBeNull();
  expect(container.textContent).toContain("Aceitar");
  expect(container.textContent).toContain("Recusar");
});
