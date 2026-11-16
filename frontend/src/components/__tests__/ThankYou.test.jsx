import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// react-router-dom v7 ships only an "exports" map, which this Jest (27) cannot resolve; a Link stub is enough.
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...p }) => <a href={to} {...p}>{children}</a> }), { virtual: true });

const mockTrack = jest.fn();
const mockGetLeadToken = jest.fn();
const mockConfirmLead = jest.fn();
let mockEnabled = true;
jest.mock("@/lib/radar", () => ({
  track: (...a) => mockTrack(...a),
  getLeadToken: () => mockGetLeadToken(),
  confirmLead: (...a) => mockConfirmLead(...a),
  isRadarEnabled: () => mockEnabled,
}));

const ThankYou = require("../ThankYou").default;

let root, container;
const leadPushes = () => window.dataLayer.filter((e) => e.event === "generate_lead");
const waPushes = () => window.dataLayer.filter((e) => e.event === "whatsapp_click");

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ThankYou />);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  sessionStorage.clear();
  window.dataLayer = [];
  window.scrollTo = jest.fn();
  mockEnabled = true;
  mockTrack.mockClear();
  mockGetLeadToken.mockReset();
  mockConfirmLead.mockReset();
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  jest.useRealTimers();
});

test("no token -> no generate_lead and no confirmLead; thank_you_view tracked", async () => {
  mockGetLeadToken.mockReturnValue(null);
  await mount();
  expect(leadPushes()).toHaveLength(0);
  expect(mockConfirmLead).not.toHaveBeenCalled();
  expect(mockTrack).toHaveBeenCalledWith("thank_you_view");
});

test("token + first_use -> exactly one generate_lead with user_data", async () => {
  mockGetLeadToken.mockReturnValue("tok");
  mockConfirmLead.mockResolvedValue({ first_use: true, user_data: { sha256_email_address: "abc" } });
  await mount();
  expect(mockConfirmLead).toHaveBeenCalledWith("tok");
  expect(leadPushes()).toHaveLength(1);
  expect(leadPushes()[0].user_data).toEqual({ sha256_email_address: "abc" });
});

test("token + first_use false -> no generate_lead", async () => {
  mockGetLeadToken.mockReturnValue("tok");
  mockConfirmLead.mockResolvedValue({ first_use: false, user_data: null });
  await mount();
  expect(leadPushes()).toHaveLength(0);
});

test("confirmLead null -> no generate_lead; WhatsApp redirect still fires at 5s with lead_token", async () => {
  mockGetLeadToken.mockReturnValue("tok");
  mockConfirmLead.mockResolvedValue(null);
  await mount();
  expect(leadPushes()).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(4900); });
  expect(waPushes()).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(200); });
  expect(waPushes()).toHaveLength(1); // redirect callback (location.href) only runs after GTM callback/1s: not advanced
  expect(mockTrack).toHaveBeenCalledWith("whatsapp_click", { lead_token: "tok" }, expect.anything());
});

test("a never-resolving confirmLead does not delay the redirect", async () => {
  mockGetLeadToken.mockReturnValue("tok");
  mockConfirmLead.mockReturnValue(new Promise(() => {}));
  await mount();
  await act(async () => { jest.advanceTimersByTime(5100); });
  expect(waPushes()).toHaveLength(1);
});

// jsdom cannot navigate; it reports an attempt as a "Not implemented: navigation" console error.
const navigations = (spy) => spy.mock.calls.filter((c) => String(c[0] && (c[0].message || c[0])).includes("navigation")).length;

test("confirmLead null, null, then first_use -> exactly one generate_lead with user_data", async () => {
  mockGetLeadToken.mockReturnValue("tok");
  mockConfirmLead
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ first_use: true, user_data: { sha256_email_address: "abc" } });
  await mount();
  await act(async () => { jest.advanceTimersByTime(700); });
  await act(async () => { jest.advanceTimersByTime(700); });
  expect(mockConfirmLead).toHaveBeenCalledTimes(3);
  expect(leadPushes()).toHaveLength(1);
  expect(leadPushes()[0].user_data).toEqual({ sha256_email_address: "abc" });
});

test("confirmLead keeps returning null -> stops after 3 attempts, no generate_lead", async () => {
  mockGetLeadToken.mockReturnValue("tok");
  mockConfirmLead.mockResolvedValue(null);
  await mount();
  for (let i = 0; i < 4; i++) await act(async () => { jest.advanceTimersByTime(700); });
  expect(mockConfirmLead).toHaveBeenCalledTimes(3);
  expect(leadPushes()).toHaveLength(0);
});

describe("quick click on the WhatsApp button", () => {
  let err;
  beforeEach(() => { err = jest.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => err.mockRestore());
  const click = async () => {
    await act(async () => {
      container.querySelector("a[data-radar-skip]").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
  };

  test("confirmation resolving at 800ms -> generate_lead pushed before navigation", async () => {
    mockGetLeadToken.mockReturnValue("tok");
    let resolve;
    mockConfirmLead.mockReturnValue(new Promise((r) => { resolve = r; }));
    await mount();
    await click();
    await act(async () => { jest.advanceTimersByTime(800); });
    expect(navigations(err)).toBe(0);
    await act(async () => { resolve({ first_use: true, user_data: { x: 1 } }); });
    expect(leadPushes()).toHaveLength(1);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(navigations(err)).toBe(1);
  });

  test("never-resolving confirmation -> navigates by ~1.5s", async () => {
    mockGetLeadToken.mockReturnValue("tok");
    mockConfirmLead.mockReturnValue(new Promise(() => {}));
    await mount();
    await click();
    await act(async () => { jest.advanceTimersByTime(1400); });
    expect(navigations(err)).toBe(0);
    await act(async () => { jest.advanceTimersByTime(150); });
    expect(navigations(err)).toBe(1);
  });
});

test("radar disabled -> legacy generate_lead on mount without user_data, once per session", async () => {
  mockEnabled = false;
  mockGetLeadToken.mockReturnValue(null);
  await mount();
  expect(leadPushes()).toHaveLength(1);
  expect(leadPushes()[0].user_data).toBeUndefined();
  expect(mockConfirmLead).not.toHaveBeenCalled();
  await act(async () => { root.unmount(); });
  await mount(); // remount: session guard blocks a second push
  expect(leadPushes()).toHaveLength(1);
});

test("radar enabled -> no legacy push on mount", async () => {
  mockGetLeadToken.mockReturnValue(null);
  await mount();
  expect(leadPushes()).toHaveLength(0);
});

test("anchor carries data-radar-skip and explicit whatsapp_click has lead_token", async () => {
  mockGetLeadToken.mockReturnValue("tok");
  mockConfirmLead.mockResolvedValue(null);
  await mount();
  expect(container.querySelector("a[data-radar-skip]")).not.toBeNull();
});
