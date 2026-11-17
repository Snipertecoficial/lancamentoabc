import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
process.env.REACT_APP_RADAR_URL = "https://r.test/fn"; // for the real submitLead used in the timeout test

// react-router-dom v7 ships only an "exports" map, which this Jest (27) cannot resolve.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });

let mockEnabled = true;
jest.mock("@/lib/radar", () => ({ isRadarEnabled: () => mockEnabled }));

const mockSubmitLead = jest.fn();
jest.mock("@/lib/radar/submitLead", () => ({ submitLead: (...a) => mockSubmitLead(...a) }));

const LeadForm = require("../LeadForm").default;

let root, container;
const $ = (sel) => container.querySelector(sel);
const form = () => $("form");
const input = (name) => $(`[name="${name}"]`);
const button = () => $('button[type="submit"]');
const alertBox = () => $('[role="alert"]');
const waLink = () => $('a[href*="whatsapp.com"]');

function type(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
async function fillValid({ name = "Ana Souza", phone = "11999999999", email = "" } = {}) {
  await act(async () => {
    type(input("name"), name);
    type(input("phone"), phone);
    if (email) type(input("email"), email);
  });
}
async function clickSubmit(times = 1) {
  await act(async () => { for (let i = 0; i < times; i++) button().click(); });
}
const flush = async () => { await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); }); };

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<LeadForm />); });
}

let consoleErr;
beforeEach(async () => {
  jest.useFakeTimers();
  sessionStorage.clear();
  window.dataLayer = [];
  mockEnabled = true;
  mockNavigate.mockReset();
  mockSubmitLead.mockReset();
  mockSubmitLead.mockResolvedValue({ ok: true, token: "tok-1" });
  // jsdom reports navigation attempts as "Not implemented: navigation" errors.
  consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});
  await mount();
  await act(async () => { jest.advanceTimersByTime(3000); }); // a human takes > 2 s to fill the form
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  consoleErr.mockRestore();
  jest.useRealTimers();
});
const navigations = () => consoleErr.mock.calls.filter((c) => String(c[0] && (c[0].message || c[0])).includes("navigation")).length;

test("form keeps the GTM id, has labelled fields, honeypot hidden from users, LGPD text with /privacidade", () => {
  expect(form().id).toBe("conversion-form-espontone");
  expect(form().noValidate).toBe(true);
  ["name", "phone", "email"].forEach((n) => {
    const el = input(n);
    expect($(`label[for="${el.id}"]`)).not.toBeNull();
  });
  expect(input("phone").type).toBe("tel");
  expect(container.querySelectorAll('input[type="radio"][name="intent"]')).toHaveLength(2);
  const hp = input("hpt");
  expect(hp.tabIndex).toBe(-1);
  expect(hp.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(container.textContent).toContain(
    "Ao enviar, você concorda em ser contatado pela Espontone sobre este lançamento, conforme nossa Política de Privacidade.",
  );
  expect($('a[href="/privacidade"]').textContent).toBe("Política de Privacidade");
});

test("phone is masked while typing", async () => {
  await act(async () => { type(input("phone"), "11999998888"); });
  expect(input("phone").value).toBe("(11) 99999-8888");
  await act(async () => { type(input("phone"), "+55 11 3333-4444"); });
  expect(input("phone").value).toBe("(11) 3333-4444");
});

test("invalid submit: errors linked by aria-describedby, aria-invalid, first invalid focused, nothing sent", async () => {
  await act(async () => { type(input("email"), "ana@x"); });
  await clickSubmit();
  expect(mockSubmitLead).not.toHaveBeenCalled();
  ["name", "phone", "email"].forEach((n) => {
    const el = input(n);
    expect(el.getAttribute("aria-invalid")).toBe("true");
    const err = document.getElementById(el.getAttribute("aria-describedby"));
    expect(err && err.textContent.length).toBeGreaterThan(5);
  });
  expect(document.activeElement).toBe(input("name"));

  // fixing a field clears its error live
  await act(async () => { type(input("name"), "Ana"); });
  expect(input("name").getAttribute("aria-invalid")).toBe("false");
  await clickSubmit();
  expect(document.activeElement).toBe(input("phone"));
});

test("double click -> one submitLead, one navigation to /obrigado", async () => {
  let resolve;
  mockSubmitLead.mockReturnValue(new Promise((r) => { resolve = r; }));
  await fillValid();
  await clickSubmit(2);
  expect(mockSubmitLead).toHaveBeenCalledTimes(1);
  expect(button().disabled).toBe(true);
  expect(button().getAttribute("aria-busy")).toBe("true");
  // Enter while sending is ignored too
  await act(async () => { form().requestSubmit(); });
  expect(mockSubmitLead).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ ok: true, token: "tok-1" }); });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith("/obrigado");
  await clickSubmit(); // still locked after success (navigation in progress)
  expect(mockSubmitLead).toHaveBeenCalledTimes(1);
});

test("sends normalized phone, trimmed fields, intent, honeypot and elapsed_ms", async () => {
  await fillValid({ name: "  Ana Souza ", phone: "(11) 99999-9999", email: " ana@x.com " });
  await act(async () => { $('input[name="intent"][value="investir"]').click(); });
  await act(async () => { type(input("hpt"), "http://spam"); });
  await clickSubmit();
  expect(mockSubmitLead).toHaveBeenCalledTimes(1);
  const f = mockSubmitLead.mock.calls[0][0];
  expect(f).toMatchObject({
    name: "Ana Souza", phone: "+5511999999999", email: "ana@x.com", intent: "investir",
    formId: "conversion-form-espontone", hp: "http://spam",
  });
  expect(f.elapsedMs).toBeGreaterThanOrEqual(3000);
});

test("server error -> clear message + WhatsApp alternative with the lead's data; form usable again", async () => {
  mockSubmitLead.mockResolvedValue({ ok: false, error: "server_error" });
  await fillValid();
  await clickSubmit();
  await flush();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(alertBox()).not.toBeNull();
  expect(alertBox().textContent).toMatch(/WhatsApp/);
  const href = decodeURIComponent(waLink().getAttribute("href"));
  expect(href).toContain("Ana Souza");
  expect(button().disabled).toBe(false);
  await clickSubmit(); // retry is allowed
  expect(mockSubmitLead).toHaveBeenCalledTimes(2);
});

test("rate limited -> specific message, WhatsApp alternative", async () => {
  mockSubmitLead.mockResolvedValue({ ok: false, error: "rate_limited" });
  await fillValid();
  await clickSubmit();
  await flush();
  expect(alertBox().textContent).toMatch(/muitos envios/i);
  expect(waLink()).not.toBeNull();
});

test("server silent for 8 s (real submitLead) -> WhatsApp alternative shown, nothing stuck", async () => {
  const real = jest.requireActual("@/lib/radar/submitLead").submitLead;
  mockSubmitLead.mockImplementation((f) => real(f));
  global.fetch = jest.fn(() => new Promise(() => {}));
  await fillValid();
  await clickSubmit();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(7900); });
  await flush();
  expect(alertBox()).toBeNull();
  await act(async () => { jest.advanceTimersByTime(200); });
  await flush();
  expect(alertBox()).not.toBeNull();
  expect(waLink()).not.toBeNull();
  expect(button().disabled).toBe(false);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("GTM: document capture and bubble listeners see the submit of #conversion-form-espontone", async () => {
  const seen = [];
  const cap = (e) => seen.push(["capture", e.target.id, e.defaultPrevented]);
  const bub = (e) => seen.push(["bubble", e.target.id, e.defaultPrevented]);
  document.addEventListener("submit", cap, true);
  document.addEventListener("submit", bub, false);
  try {
    await fillValid();
    await clickSubmit();
  } finally {
    document.removeEventListener("submit", cap, true);
    document.removeEventListener("submit", bub, false);
  }
  // capture sees the untouched native event; React (root listener) prevents the reload before bubble reaches document
  expect(seen).toEqual([
    ["capture", "conversion-form-espontone", false],
    ["bubble", "conversion-form-espontone", true],
  ]);
  expect(window.dataLayer.filter((e) => e.event === "lead_form_submit_attempt")).toHaveLength(1);
});

test("submit attempt signal is pushed even when validation fails", async () => {
  await clickSubmit();
  expect(window.dataLayer.filter((e) => e.event === "lead_form_submit_attempt")).toHaveLength(1);
});

test("radar disabled -> no submitLead; opens WhatsApp prefilled with the lead (no lead lost)", async () => {
  mockEnabled = false;
  await fillValid({ name: "Ana Souza", phone: "11999999999" });
  await act(async () => { $('input[name="intent"][value="morar"]').click(); });
  await clickSubmit();
  expect(mockSubmitLead).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  const href = decodeURIComponent(waLink().getAttribute("href"));
  expect(href).toContain("Ana Souza");
  expect(href).toContain("(11) 99999-9999");
  expect(href).toMatch(/morar/i);
  expect(window.dataLayer.filter((e) => e.event === "whatsapp_click")).toHaveLength(1);
  await act(async () => { jest.advanceTimersByTime(1100); }); // GTM callback timeout -> navigate
  expect(navigations()).toBe(1);
});
