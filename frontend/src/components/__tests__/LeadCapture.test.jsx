import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
process.env.REACT_APP_RADAR_URL = "https://r.test/fn"; // real submitLead + pendingLead

// react-router-dom v7 ships only an "exports" map, which this Jest (27) cannot resolve.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });

const mockTrack = jest.fn();
jest.mock("@/lib/radar", () => ({
  isRadarEnabled: () => true,
  sessionMeta: () => ({ landing_url: "http://localhost/" }),
  track: (...a) => mockTrack(...a),
}));

// Lets a test make the (lazy) modal crash, to check the fallback to the bottom form.
let mockModalCrash = false;
jest.mock("@/components/LeadCaptureModal", () => {
  const R = jest.requireActual("react");
  const Real = jest.requireActual("@/components/LeadCaptureModal").default;
  return {
    __esModule: true,
    default: (p) => {
      if (mockModalCrash) throw new Error("chunk failed");
      return R.createElement(Real, p);
    },
  };
});

// IntersectionObserver stub: tests decide when the bottom form is on screen.
let observers = [];
class MockIO {
  constructor(cb) { this.cb = cb; this.targets = []; observers.push(this); }
  observe(el) { this.targets.push(el); }
  disconnect() { this.targets = []; }
}
const fireIO = async (el, entry) => {
  await act(async () => {
    observers.forEach((o) => { if (o.targets.includes(el)) o.cb([{ target: el, ...entry }]); });
  });
};
const setFormInView = (visible) => fireIO(document.getElementById("rd-form-section"),
  { isIntersecting: visible, boundingClientRect: { top: 100, bottom: 600 } });

const { LeadCaptureProvider } = require("../LeadCaptureProvider");
const { openWhatsApp, WA_MESSAGES } = require("@/lib/whatsapp");

let root, container, scrollSpy, openSpy, consoleErr;
const $ = (sel) => document.querySelector(sel);
const modalForm = () => document.getElementById("conversion-form-espontone-modal");
const input = (name) => modalForm().querySelector(`[name="${name}"]`);
const submitBtn = () => modalForm().querySelector('button[type="submit"]');
const floating = () => $('[data-testid="floating-whatsapp"]');
const flush = async () => { await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); }); };

function type(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
async function fillValid() {
  await act(async () => {
    type(input("name"), "Ana Souza");
    type(input("phone"), "11999999999");
  });
}
async function clickSubmit(times = 1) {
  await act(async () => { for (let i = 0; i < times; i++) submitBtn().click(); });
  await flush();
}
const readBlob = (blob) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsText(blob);
});
const res = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

// A page like Home: CTA buttons + the bottom form section, inside the provider.
const Page = () => (
  <>
    <button data-testid="hero-cta" onClick={() => openWhatsApp(WA_MESSAGES.hero, "hero_cta_whatsapp")}>Quero condições exclusivas</button>
    <div id="rd-form-section"><div id="form-lead" /></div>
  </>
);

async function mount(el = <LeadCaptureProvider><Page /></LeadCaptureProvider>) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
  await flush();
}
// Home's hero: the CTA block the floating button waits to be scrolled past.
const HeroPage = () => (
  <>
    <div data-hero-ctas="">
      <button data-testid="hero-cta" onClick={() => openWhatsApp(WA_MESSAGES.hero, "hero_cta_whatsapp")}>Quero condições exclusivas</button>
    </div>
    <div id="rd-form-section"><div id="form-lead" /></div>
  </>
);
const pressEsc = async () => {
  await act(async () => {
    (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await flush();
};
const settleFocus = async () => { await act(async () => { jest.advanceTimersByTime(50); }); await flush(); };

async function clickHero() {
  await act(async () => { $('[data-testid="hero-cta"]').click(); });
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers();
  sessionStorage.clear();
  window.dataLayer = [];
  observers = [];
  global.IntersectionObserver = MockIO;
  mockModalCrash = false;
  mockNavigate.mockReset();
  mockTrack.mockReset();
  global.fetch = jest.fn(() => res(200, { ok: true, lead_token: "tok-modal" }));
  navigator.sendBeacon = jest.fn(() => true);
  scrollSpy = jest.fn();
  Element.prototype.scrollIntoView = scrollSpy;
  openSpy = jest.spyOn(window, "open").mockImplementation(() => ({ opener: window }));
  consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  if (container) container.remove();
  root = null;
  container = null;
  openSpy.mockRestore();
  consoleErr.mockRestore();
  delete navigator.sendBeacon;
  delete global.IntersectionObserver;
  window.history.pushState({}, "", "/");
  jest.useRealTimers();
});

// Must stay the FIRST test of this file: React.lazy keeps the loaded chunk for the following tests.
test("first open: an on-brand loading state shows while the modal chunk loads", async () => {
  await mount();
  act(() => { $('[data-testid="hero-cta"]').click(); }); // sync act: the lazy import has not resolved yet
  const loading = $('[data-testid="lead-capture-loading"]');
  expect(loading).not.toBeNull();
  expect(loading.getAttribute("role")).toBe("status");
  expect(loading.textContent).toMatch(/Carregando/);
  await flush();
  expect($('[data-testid="lead-capture-loading"]')).toBeNull();
  expect(modalForm()).not.toBeNull();
});

test("modal chunk is prefetched when the browser is idle", async () => {
  window.requestIdleCallback = jest.fn(() => 1);
  window.cancelIdleCallback = jest.fn();
  try {
    await mount();
    expect(window.requestIdleCallback).toHaveBeenCalledTimes(1);
  } finally {
    delete window.requestIdleCallback;
    delete window.cancelIdleCallback;
  }
});

describe("CTAs open the capture modal", () => {
  test("openWhatsApp opens the modal: no scroll, no WhatsApp; GTM click + form_view tracked", async () => {
    await mount();
    await clickHero();
    expect(modalForm()).not.toBeNull();
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
    expect(window.dataLayer.filter((e) => e.event === "whatsapp_click")).toEqual([
      expect.objectContaining({ link_location: "hero_cta_whatsapp" }),
    ]);
    expect(mockTrack).toHaveBeenCalledWith("form_view", { form_id: "modal-hero_cta_whatsapp" });
    // tracked props never carry what the visitor types
    mockTrack.mock.calls.forEach((c) => expect(JSON.stringify(c)).not.toMatch(/Ana|99999/));
  });

  test("modal content: title, name + WhatsApp only, POST form, honeypot, LGPD link, labelled close button", async () => {
    await mount();
    await clickHero();
    const dialog = $('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")).textContent).toBe("Fale com um corretor agora");
    const form = modalForm();
    expect(form.getAttribute("method")).toBe("post");
    const visible = [...form.querySelectorAll("input")].filter((i) => !i.closest('[aria-hidden="true"]')).map((i) => i.name);
    expect(visible).toEqual(["name", "phone"]);
    expect(input("phone").type).toBe("tel");
    expect(input("hpt").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(submitBtn().textContent).toBe("Seguir para o atendimento");
    expect(form.querySelector('a[href="/privacidade"]')).not.toBeNull();
    expect(dialog.querySelector('button[aria-label="Fechar"]')).not.toBeNull();
  });

  test("first field is focused on open; Esc closes the modal", async () => {
    await mount();
    await clickHero();
    expect(document.activeElement).toBe(input("name"));
    await act(async () => {
      document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await flush();
    expect(modalForm()).toBeNull();
  });

  test("closing returns focus to the CTA that opened it", async () => {
    await mount();
    const cta = $('[data-testid="hero-cta"]');
    cta.focus();
    await clickHero();
    expect(document.activeElement).toBe(input("name"));
    await pressEsc();
    await settleFocus();
    expect(modalForm()).toBeNull();
    expect(document.activeElement).toBe(cta);
  });

  test("opened from the floating button (hidden while open): focus returns to it when it reappears", async () => {
    await mount();
    floating().focus();
    await act(async () => { floating().click(); });
    await flush();
    expect(floating()).toBeNull();
    await pressEsc();
    await settleFocus();
    expect(floating()).not.toBeNull();
    expect(document.activeElement).toBe(floating());
  });

  test("floating opener that stays hidden after closing -> focus falls back to the first CTA", async () => {
    await mount(<LeadCaptureProvider><HeroPage /></LeadCaptureProvider>);
    const hero = $('[data-hero-ctas]');
    await fireIO(hero, { isIntersecting: false, boundingClientRect: { top: -300, bottom: -200 } });
    floating().focus();
    await act(async () => { floating().click(); });
    await flush();
    await fireIO(hero, { isIntersecting: true, boundingClientRect: { top: 10, bottom: 110 } }); // back at the hero
    await pressEsc();
    await settleFocus();
    expect(floating()).toBeNull();
    expect(document.activeElement).toBe($('[data-testid="hero-cta"]'));
  });

  test("close button closes the modal", async () => {
    await mount();
    await clickHero();
    await act(async () => { $('button[aria-label="Fechar"]').click(); });
    await flush();
    expect(modalForm()).toBeNull();
  });

  test("without a provider (or if the modal cannot open) openWhatsApp scrolls to the bottom form, never WhatsApp", async () => {
    await mount(<Page />);
    await clickHero();
    expect(modalForm()).toBeNull();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
  });

  test("modal crash (e.g. chunk failed to load) -> falls back to scrolling to the bottom form", async () => {
    mockModalCrash = true;
    await mount();
    await clickHero();
    expect(modalForm()).toBeNull();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    await clickHero(); // later CTAs scroll directly
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe("modal submit", () => {
  beforeEach(async () => {
    await mount();
    await act(async () => { jest.advanceTimersByTime(3000); });
    await clickHero();
  });

  test("success -> submit-lead with the modal form_id, token stored, pending cleared, navigate('/obrigado')", async () => {
    sessionStorage.setItem("radar_pending_lead", JSON.stringify({ name: "Old" }));
    await fillValid();
    await clickSubmit();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://r.test/fn/submit-lead");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ name: "Ana Souza", phone: "+5511999999999", form_id: "modal-hero_cta_whatsapp", hp: "" });
    expect(body).not.toHaveProperty("email");
    expect(body.form_id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(body.elapsed_ms).toBeGreaterThanOrEqual(2000);
    expect(sessionStorage.getItem("radar_lead_token")).toBe("tok-modal");
    expect(sessionStorage.getItem("radar_pending_lead")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/obrigado");
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  test("while sending, the modal cannot be dismissed (X disabled, Esc ignored); after a failure it can", async () => {
    let resolve;
    global.fetch = jest.fn(() => new Promise((r) => { resolve = r; }));
    await fillValid();
    await clickSubmit();
    const x = $('button[aria-label="Fechar"]');
    expect(x.disabled).toBe(true);
    await act(async () => { x.click(); });
    await pressEsc();
    expect(modalForm()).not.toBeNull();
    await act(async () => { resolve(await res(500, { ok: false, error: "server" })); });
    await flush();
    expect($('button[aria-label="Fechar"]').disabled).toBe(false);
    await pressEsc();
    expect(modalForm()).toBeNull();
  });

  test("unmounted mid-submit + network failure -> beacon sent and pending lead saved anyway", async () => {
    let reject;
    global.fetch = jest.fn(() => new Promise((_, rj) => { reject = rj; }));
    await fillValid();
    await clickSubmit();
    await act(async () => { root.unmount(); });
    root = null;
    await act(async () => { reject(new TypeError("Failed to fetch")); });
    await flush();
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem("radar_pending_lead"))).toMatchObject({ name: "Ana Souza" });
  });

  test("unmounted mid-submit + success -> still navigates to /obrigado", async () => {
    let resolve;
    global.fetch = jest.fn(() => new Promise((r) => { resolve = r; }));
    await fillValid();
    await clickSubmit();
    await act(async () => { root.unmount(); });
    root = null;
    await act(async () => { resolve(await res(200, { ok: true, lead_token: "tok-late" })); });
    await flush();
    expect(sessionStorage.getItem("radar_lead_token")).toBe("tok-late");
    expect(mockNavigate).toHaveBeenCalledWith("/obrigado");
  });

  test("validation errors: nothing sent, fields marked invalid, first invalid focused", async () => {
    await clickSubmit();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(input("name").getAttribute("aria-invalid")).toBe("true");
    expect(input("phone").getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input("phone").getAttribute("aria-describedby")).textContent).toMatch(/DDD/);
    expect(document.activeElement).toBe(input("name"));
  });

  test("phone mask is the same as the bottom form", async () => {
    await act(async () => { type(input("phone"), "11999998888"); });
    expect(input("phone").value).toBe("(11) 99999-8888");
  });

  test("double submit -> one request", async () => {
    let resolve;
    global.fetch = jest.fn(() => new Promise((r) => { resolve = r; }));
    await fillValid();
    await clickSubmit(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(submitBtn().disabled).toBe(true);
    await act(async () => { resolve(await res(200, { ok: true, lead_token: "tok-2" })); });
    await flush();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  test("network failure -> sendBeacon with the same body, pending saved, WhatsApp fallback without PII", async () => {
    global.fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    await fillValid();
    await clickSubmit();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = navigator.sendBeacon.mock.calls[0];
    expect(url).toBe("https://r.test/fn/submit-lead");
    expect(blob.type).toMatch(/^text\/plain/);
    expect(JSON.parse(await readBlob(blob))).toEqual(JSON.parse(global.fetch.mock.calls[0][1].body));

    const pending = JSON.parse(sessionStorage.getItem("radar_pending_lead"));
    expect(pending).toMatchObject({ name: "Ana Souza", phone: "+5511999999999", formId: "modal-hero_cta_whatsapp" });
    expect(localStorage.getItem("radar_pending_lead")).toBeNull();

    const alert = modalForm().querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    const wa = alert.querySelector('a[href*="whatsapp.com"]');
    expect(wa).not.toBeNull();
    // error state: a single primary green button (the chat); retry becomes a secondary outline button
    const greens = [...$('[data-testid="lead-capture-modal"]').querySelectorAll(".btn-whatsapp")];
    expect(greens).toEqual([wa]);
    expect(submitBtn().classList.contains("btn-secondary-outline")).toBe(true);
    expect(submitBtn().textContent).toBe("Tentar novamente");
    expect(decodeURIComponent(alert.innerHTML)).not.toMatch(/Ana|99999/);
    // the prefilled chat is only built on click
    await act(async () => { wa.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })); });
    expect(decodeURIComponent(openSpy.mock.calls[0][0])).toContain("Ana Souza");
  });

  test("server 500 -> rescued too", async () => {
    global.fetch = jest.fn(() => res(500, { ok: false, error: "server" }));
    await fillValid();
    await clickSubmit();
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("radar_pending_lead")).not.toBeNull();
  });

  test.each([
    [429, "rate_limited"],
    [400, "invalid_phone"],
    [400, "invalid_request"],
  ])("HTTP %i %s -> no beacon, nothing pending", async (status, error) => {
    global.fetch = jest.fn(() => res(status, { ok: false, error }));
    await fillValid();
    await clickSubmit();
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("radar_pending_lead")).toBeNull();
  });

  test("GTM: document listeners see the native submit of #conversion-form-espontone-modal", async () => {
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
    expect(seen).toEqual([
      ["capture", "conversion-form-espontone-modal", false],
      ["bubble", "conversion-form-espontone-modal", true],
    ]);
    expect(seen[0][1]).toContain("conversion-form-espontone"); // the GTM "contains" trigger
    expect(window.dataLayer.filter((e) => e.event === "lead_form_submit_attempt")).toHaveLength(1);
  });
});

describe("mobile bottom sheet", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn((q) => ({
      matches: q.includes("max-width: 767px"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    }));
  });
  afterEach(() => { delete window.matchMedia; });

  test("below 768px the same form opens in a drawer and submits", async () => {
    await mount();
    await act(async () => { jest.advanceTimersByTime(3000); });
    await clickHero();
    const sheet = $('[data-testid="lead-capture-modal"]');
    expect(sheet).not.toBeNull();
    expect(sheet.hasAttribute("data-vaul-drawer")).toBe(true);
    expect(modalForm()).not.toBeNull();
    await fillValid();
    await clickSubmit();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/obrigado");
  });
});

describe("floating WhatsApp button", () => {
  test("shown on the landing; opens the modal and hides while it is open; back after closing", async () => {
    await mount();
    expect(floating()).not.toBeNull();
    expect(floating().getAttribute("aria-label")).toMatch(/Falar com corretor/);
    await act(async () => { floating().click(); });
    await flush();
    expect(modalForm()).not.toBeNull();
    expect(floating()).toBeNull();
    expect(window.dataLayer.filter((e) => e.event === "whatsapp_click")[0].link_location).toBe("floating_whatsapp");
    expect(mockTrack).toHaveBeenCalledWith("form_view", { form_id: "modal-floating_whatsapp" });
    await act(async () => { $('button[aria-label="Fechar"]').click(); });
    await flush();
    expect(floating()).not.toBeNull();
  });

  test.each(["/login", "/painel", "/painel/leads", "/obrigado"])("never rendered on %s", async (path) => {
    window.history.pushState({}, "", path);
    await mount();
    expect(floating()).toBeNull();
  });

  test("on the landing it waits until the hero CTAs were scrolled past", async () => {
    await mount(<LeadCaptureProvider><HeroPage /></LeadCaptureProvider>);
    expect(floating()).toBeNull();
    const hero = $('[data-hero-ctas]');
    await fireIO(hero, { isIntersecting: false, boundingClientRect: { top: 900, bottom: 1000 } }); // still below the fold
    expect(floating()).toBeNull();
    await fireIO(hero, { isIntersecting: false, boundingClientRect: { top: -300, bottom: -200 } }); // scrolled past
    expect(floating()).not.toBeNull();
    await setFormInView(true);
    expect(floating()).toBeNull();
    await setFormInView(false);
    await fireIO(hero, { isIntersecting: true, boundingClientRect: { top: 10, bottom: 110 } }); // back up
    expect(floating()).toBeNull();
  });

  test("kept on /privacidade", async () => {
    window.history.pushState({}, "", "/privacidade");
    await mount();
    expect(floating()).not.toBeNull();
  });

  test("hidden while the bottom form is on screen", async () => {
    await mount();
    expect(floating()).not.toBeNull();
    await setFormInView(true);
    expect(floating()).toBeNull();
    await setFormInView(false);
    expect(floating()).not.toBeNull();
  });

  test("bottom form mounted later (lazy) is still observed", async () => {
    const Late = () => {
      const [show, setShow] = React.useState(false);
      return (<><button data-testid="show" onClick={() => setShow(true)} />{show && <div id="rd-form-section" />}</>);
    };
    await mount(<LeadCaptureProvider><Late /></LeadCaptureProvider>);
    await act(async () => { $('[data-testid="show"]').click(); });
    await flush();
    await setFormInView(true);
    expect(floating()).toBeNull();
  });

  test("on phones it rises above the cookie banner", async () => {
    const width = window.innerWidth;
    window.innerWidth = 375;
    try {
      await mount();
      expect(floating().getAttribute("data-lift")).toBe("0");
      const banner = document.createElement("div");
      banner.id = "cookie-consent";
      banner.style.bottom = "16px";
      banner.getBoundingClientRect = () => ({ height: 120, top: 0, bottom: 0, left: 0, right: 0, width: 300 });
      await act(async () => { document.body.appendChild(banner); });
      await flush();
      expect(floating().getAttribute("data-lift")).toBe("148"); // banner 120 + its bottom 16 + gap 12
      await act(async () => { banner.remove(); });
      await flush();
      expect(floating().getAttribute("data-lift")).toBe("0");
    } finally {
      window.innerWidth = width;
    }
  });
});
