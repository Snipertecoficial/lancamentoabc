const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const readBlob = (b) =>
  new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsText(b); });

function load(url) {
  jest.resetModules();
  if (url) process.env.REACT_APP_RADAR_URL = url;
  else delete process.env.REACT_APP_RADAR_URL;
  const m = require("../index");
  loaded.push(m);
  return m;
}
const loaded = [];
afterEach(() => { loaded.splice(0).forEach((m) => m.__stopRadar()); }); // no leaked listeners across tests

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  global.fetch = jest.fn(() => Promise.reject(new Error("offline")));
  navigator.sendBeacon = jest.fn(() => true);
});

test("no URL: track is a no-op", () => {
  const r = load("");
  r.initRadar();
  r.track("page_view");
  window.dispatchEvent(new Event("pagehide"));
  expect(global.fetch).not.toHaveBeenCalled();
  expect(navigator.sendBeacon).not.toHaveBeenCalled();
});

test("batch has v, env, session_id, landing_url and event", () => {
  const r = load("https://r.test/fn");
  r.initRadar();
  r.initRadar();
  r.track("cta_click", { a: 1 }, { name: "hero", section: "hero" });
  window.dispatchEvent(new Event("pagehide"));
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  const [url, blob] = navigator.sendBeacon.mock.calls[0];
  expect(url).toBe("https://r.test/fn/ingest");
  return readBlob(blob).then((t) => {
    const b = JSON.parse(t);
    expect(b.v).toBe(1);
    expect(b.env).toBe("staging");
    expect(b.session_id).toMatch(UUID);
    expect(b.visitor_id).toBeNull();
    expect(b.session.landing_url).toMatch(/^http/);
    const ev = b.events.find((e) => e.type === "cta_click"); // initRadar's page_view comes first
    expect(ev).toMatchObject({ type: "cta_click", name: "hero", section: "hero", props: { a: 1 } });
    expect(ev.id).toMatch(UUID);
  });
});

test("identifyLead returns token and stores it even if send fails", async () => {
  const r = load("https://r.test/fn");
  const t = r.identifyLead({ name: "A", phone: "+5511999999999", email: "a@b.c", formId: "f" });
  expect(t).toMatch(UUID);
  expect(sessionStorage.getItem("radar_lead_token")).toBe(t);
  expect(r.getLeadToken()).toBe(t);
  const body = JSON.parse(await readBlob(navigator.sendBeacon.mock.calls[0][1]));
  expect(body.events[0]).toMatchObject({
    type: "lead_submitted",
    props: { lead_token: t, form_id: "f", name: "A", phone: "+5511999999999", email: "a@b.c" },
  });
});

test("confirmLead parses ok, returns null on failure", async () => {
  const r = load("https://r.test/fn");
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, first_use: true, user_data: null }) }));
  expect(await r.confirmLead("tok")).toEqual({ first_use: true, user_data: null });
  expect(global.fetch.mock.calls[0][0]).toBe("https://r.test/fn/confirm-lead");
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) }));
  expect(await r.confirmLead("tok")).toBeNull();
  global.fetch = jest.fn(() => Promise.reject(new Error("x")));
  expect(await r.confirmLead("tok")).toBeNull();
});

describe("section_view timing + flush ordering", () => {
  let cb, now, vis;
  const setVis = (v) => { vis = v; document.dispatchEvent(new Event("visibilitychange")); };
  const events = async (n) => JSON.parse(await readBlob(navigator.sendBeacon.mock.calls[n][1])).events;
  beforeEach(() => {
    now = 1000; vis = "visible";
    jest.spyOn(Date, "now").mockImplementation(() => now);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
    global.IntersectionObserver = jest.fn((f) => { cb = f; return { observe: jest.fn(), disconnect: jest.fn() }; });
    document.body.innerHTML = '<section id="faq"></section>';
  });
  afterEach(() => { delete global.IntersectionObserver; delete document.visibilityState; jest.restoreAllMocks(); });
  const enter = () => cb([{ target: document.querySelector("section"), isIntersecting: true, intersectionRatio: 1 }]);

  test("visibilitychange hidden: section_view is in the beaconed batch", async () => {
    const r = load("https://r.test/fn"); r.initRadar(); enter();
    now = 6000; setVis("hidden");
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect((await events(0)).find((e) => e.type === "section_view")).toMatchObject({ section: "faq", props: { seconds: 5 } });
  });

  test("pagehide: section_view is in the beaconed batch", async () => {
    const r = load("https://r.test/fn"); r.initRadar(); enter();
    now = 4000; window.dispatchEvent(new Event("pagehide"));
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect((await events(0)).find((e) => e.type === "section_view").props.seconds).toBe(3);
  });

  test("hidden time is not counted", async () => {
    const r = load("https://r.test/fn"); r.initRadar(); enter();
    now = 3000; setVis("hidden");            // 2 s in view
    now = 13000; setVis("visible");          // 10 s hidden
    now = 15000;                              // leaves 2 s after returning
    cb([{ target: document.querySelector("section"), isIntersecting: false, intersectionRatio: 0 }]);
    window.dispatchEvent(new Event("pagehide"));
    const all = [];
    for (let i = 0; i < navigator.sendBeacon.mock.calls.length; i++) all.push(...(await events(i)));
    expect(all.filter((e) => e.type === "section_view").map((e) => e.props.seconds)).toEqual([2, 2]);
  });
});

test("form_abandon is enqueued before the pagehide flush and lands in the beaconed batch", async () => {
  document.body.innerHTML = '<form id="f"><input name="email" /></form>';
  const r = load("https://r.test/fn");
  r.initRadar();
  document.querySelector('[name="email"]').dispatchEvent(new Event("focusin", { bubbles: true }));
  window.dispatchEvent(new Event("pagehide"));
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  const b = JSON.parse(await readBlob(navigator.sendBeacon.mock.calls[0][1]));
  expect(b.events.find((e) => e.type === "form_abandon").props).toEqual({ last_field: "email" });
  document.body.innerHTML = "";
});
