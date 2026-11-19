import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockTrack = jest.fn();
jest.mock("@/lib/radar", () => ({
  track: (...a) => mockTrack(...a),
  chatCode: () => "A1B2C3",
}));

const { setLeadCaptureOpener } = require("@/lib/leadCapture");
const { WA_MESSAGES, openWhatsAppDirect } = require("@/lib/whatsapp");
const Header = require("../Header").default;
const Footer = require("../Footer").default;
const HeroSection = require("../HeroSection").default;

let root, container, openSpy, consoleErr, capture, stopCapture;
const $ = (sel) => document.querySelector(sel);
const textOf = (url) => new URL(url).searchParams.get("text");

async function mount(el) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
}
async function click(el) {
  await act(async () => { el.click(); });
}

beforeEach(() => {
  window.dataLayer = [];
  mockTrack.mockReset();
  capture = jest.fn(() => true);
  stopCapture = setLeadCaptureOpener(capture);
  openSpy = jest.spyOn(window, "open").mockImplementation(() => ({ opener: window }));
  consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  if (container) container.remove();
  root = null;
  container = null;
  stopCapture();
  openSpy.mockRestore();
  consoleErr.mockRestore();
});

describe("openWhatsAppDirect", () => {
  test("opens the chat in a new tab with the message + site code; Radar and GTM see the click; no form", () => {
    const tab = { opener: window };
    openSpy.mockImplementation(() => tab);
    openWhatsAppDirect("Oi! Quero saber mais.", "footer");
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(target).toBe("_blank");
    expect(url).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?phone=\d+&text=/);
    expect(textOf(url)).toBe("Oi! Quero saber mais.\n\nCódigo do site: A1B2C3");
    expect(tab.opener).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith("whatsapp_click", { source: "footer", code: "A1B2C3" }, { name: "direct" });
    expect(window.dataLayer).toEqual([expect.objectContaining({ event: "whatsapp_click", link_location: "footer" })]);
    expect(capture).not.toHaveBeenCalled();
  });

  test("popup blocked -> follows the chat link in the same tab", () => {
    openSpy.mockImplementation(() => null);
    openWhatsAppDirect("Oi!", "footer");
    // jsdom cannot navigate away; it reports the attempt instead.
    expect(consoleErr.mock.calls.map((c) => String(c[0] && (c[0].message || c[0]))).join(" ")).toMatch(/navigation/i);
  });
});

describe("broker chat buttons go straight to WhatsApp", () => {
  test("footer phone number", async () => {
    await mount(<Footer />);
    await click($('[data-testid="footer-whatsapp"]'));
    expect(textOf(openSpy.mock.calls[0][0])).toBe(`${WA_MESSAGES.general}\n\nCódigo do site: A1B2C3`);
    expect(capture).not.toHaveBeenCalled();
  });

  test("header 'Fale com corretor' (desktop and phone menu)", async () => {
    await mount(<Header />);
    await click($('[data-testid="header-cta-whatsapp"]'));
    await click($('[data-testid="mobile-menu-toggle"]'));
    const menuCta = [...document.querySelectorAll("button")].filter((b) => /Fale com corretor/.test(b.textContent)).pop();
    await click(menuCta);
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(mockTrack.mock.calls.map((c) => c[1].source)).toEqual(["header_desktop", "header_mobile"]);
    expect(capture).not.toHaveBeenCalled();
  });

  test("hero 'Falar com corretor' goes to WhatsApp; 'Agendar visita' and 'Quero condições exclusivas' keep the form", async () => {
    await mount(<HeroSection />);
    await click($('[data-testid="hero-cta-talk"]'));
    expect(textOf(openSpy.mock.calls[0][0])).toBe(`${WA_MESSAGES.finalCta}\n\nCódigo do site: A1B2C3`);
    expect(capture).not.toHaveBeenCalled();

    await click($('[data-testid="hero-cta-visit"]'));
    await click($('[data-testid="hero-cta-whatsapp"]'));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls.map((c) => c[0].source)).toEqual(["hero_agendar_visita", "hero_cta_whatsapp"]);
  });
});
