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

describe("radar:consent event", () => {
  const consent = (granted) => window.dispatchEvent(new CustomEvent("radar:consent", { detail: { granted } }));
  const flushBatch = async (n) => {
    window.dispatchEvent(new Event("pagehide"));
    return JSON.parse(await readBlob(navigator.sendBeacon.mock.calls[n][1]));
  };

  test("granted: the very next batch carries a non-null visitor_id", async () => {
    const r = load("https://r.test/fn");
    r.initRadar();
    consent(true);
    expect((await flushBatch(0)).visitor_id).toMatch(UUID);
  });

  test("denied: the very next batch carries a null visitor_id, even if storage still says granted", async () => {
    localStorage.setItem("lgpd-consent", "granted");
    const r = load("https://r.test/fn");
    r.initRadar();
    consent(false);
    expect((await flushBatch(0)).visitor_id).toBeNull();
  });

  test("granted then denied flips back to null", async () => {
    const r = load("https://r.test/fn");
    r.initRadar();
    consent(true);
    consent(false);
    expect((await flushBatch(0)).visitor_id).toBeNull();
  });
});

describe("revoking consent removes the persistent visitor id", () => {
  const consent = (granted) => window.dispatchEvent(new CustomEvent("radar:consent", { detail: { granted } }));

  test("accept: cookie exists; deny: cookie and localStorage mirror gone, next batch visitor_id null", async () => {
    const r = load("https://r.test/fn");
    r.initRadar();
    localStorage.setItem("lgpd-consent", "granted");
    consent(true);
    window.dispatchEvent(new Event("pagehide"));
    const first = JSON.parse(await readBlob(navigator.sendBeacon.mock.calls[0][1]));
    expect(first.visitor_id).toMatch(UUID);
    expect(document.cookie).toContain("rdr_vid=" + first.visitor_id);
    expect(localStorage.getItem("rdr_vid")).toBe(first.visitor_id);

    localStorage.setItem("lgpd-consent", "denied");
    consent(false);
    expect(document.cookie).not.toContain("rdr_vid");
    expect(localStorage.getItem("rdr_vid")).toBeNull();

    r.track("cta_click");
    window.dispatchEvent(new Event("pagehide"));
    const next = JSON.parse(await readBlob(navigator.sendBeacon.mock.calls[1][1]));
    expect(next.visitor_id).toBeNull();
    expect(document.cookie).not.toContain("rdr_vid");
  });
});

describe("campaign attribution refresh", () => {
  const AD = "/?utm_source=google&utm_medium=cpc&utm_campaign=lp&gclid=G1&keyword=casa";
  const batch = async (n) => JSON.parse(await readBlob(navigator.sendBeacon.mock.calls[n][1]));
  const hide = () => window.dispatchEvent(new Event("pagehide"));
  afterEach(() => { window.history.replaceState({}, "", "/"); });

  test("reload with ad params after a no-param visit starts a NEW session with attribution", async () => {
    window.history.replaceState({}, "", "/");
    let r = load("https://r.test/fn"); r.initRadar(); hide();
    const first = await batch(0);
    expect(first.session.gclid).toBeUndefined();
    r.__stopRadar();
    window.history.replaceState({}, "", AD);
    r = load("https://r.test/fn"); r.initRadar(); hide();
    const second = await batch(1);
    expect(second.session_id).not.toBe(first.session_id);
    expect(second.session).toMatchObject({ gclid: "G1", utm_source: "google", utm_medium: "cpc", utm_campaign: "lp", keyword: "casa" });
  });

  test("SPA navigation to an ad URL starts a NEW session; earlier events keep the old one", async () => {
    window.history.replaceState({}, "", "/");
    const r = load("https://r.test/fn"); r.initRadar();
    window.history.pushState({}, "", AD);
    hide();
    const first = await batch(0);
    const second = await batch(1);
    expect(first.session.gclid).toBeUndefined();
    expect(second.session_id).not.toBe(first.session_id);
    expect(second.session.gclid).toBe("G1");
  });

  test("reload of /obrigado without params keeps cached ad attribution and session_id", async () => {
    window.history.replaceState({}, "", AD);
    let r = load("https://r.test/fn"); r.initRadar(); hide();
    const first = await batch(0);
    r.__stopRadar();
    window.history.replaceState({}, "", "/obrigado");
    r = load("https://r.test/fn"); r.initRadar(); hide();
    const second = await batch(1);
    expect(second.session_id).toBe(first.session_id);
    expect(second.session.gclid).toBe("G1");
    expect(second.session.utm_source).toBe("google");
  });

  test("reload of the same ad URL does not rotate the session", async () => {
    window.history.replaceState({}, "", AD);
    let r = load("https://r.test/fn"); r.initRadar(); hide();
    const first = await batch(0);
    r.__stopRadar();
    r = load("https://r.test/fn"); r.initRadar(); hide();
    expect((await batch(1)).session_id).toBe(first.session_id);
  });

  test("fresh session with params works as before", async () => {
    window.history.replaceState({}, "", AD);
    const r = load("https://r.test/fn"); r.initRadar(); hide();
    const b = await batch(0);
    expect(b.session_id).toMatch(UUID);
    expect(b.session).toMatchObject({ gclid: "G1", utm_campaign: "lp" });
  });
});
