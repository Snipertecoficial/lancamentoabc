const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function load(url) {
  jest.resetModules();
  if (url) process.env.REACT_APP_RADAR_URL = url;
  else delete process.env.REACT_APP_RADAR_URL;
  return require("../submitLead").submitLead;
}

const fields = {
  name: "Ana Souza", phone: "+5511999999999", email: "ana@x.com", intent: "morar",
  formId: "conversion-form-espontone", hp: "", elapsedMs: 5123,
};
const res = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.cookie = "rdr_vid=; max-age=0; path=/";
  global.fetch = jest.fn(() => res(200, { ok: true, lead_token: "tok-1" }));
});
afterEach(() => jest.useRealTimers());

test("POSTs text/plain JSON with the contract fields to ${RADAR_URL}/submit-lead", async () => {
  const submitLead = load("https://r.test/fn");
  await submitLead(fields);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe("https://r.test/fn/submit-lead");
  expect(init.method).toBe("POST");
  expect(init.headers["Content-Type"]).toMatch(/^text\/plain/);
  const b = JSON.parse(init.body);
  expect(b).toEqual({
    env: "staging", session_id: expect.stringMatching(UUID), visitor_id: null,
    session: expect.objectContaining({ landing_url: expect.stringMatching(/^http/) }),
    name: "Ana Souza", phone: "+5511999999999", email: "ana@x.com", intent: "morar",
    form_id: "conversion-form-espontone", hp: "", elapsed_ms: 5123,
  });
  expect(b.session_id).toBe(sessionStorage.getItem("rdr_sid")); // same session the SDK uses
});

test("body carries the same SessionMeta the radar batches send (utm/gclid of the landing)", async () => {
  window.history.pushState({}, "", "/?utm_source=google&utm_campaign=sbc&gclid=G123");
  try {
    const submitLead = load("https://r.test/fn");
    await submitLead(fields);
    const b = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(b.session).toMatchObject({ utm_source: "google", utm_campaign: "sbc", gclid: "G123" });
    expect(b.session).toEqual(JSON.parse(sessionStorage.getItem("rdr_attr"))); // the SDK's cached meta
  } finally {
    window.history.pushState({}, "", "/");
  }
});

test("visitor_id is sent only with consent; optional fields omitted when empty", async () => {
  localStorage.setItem("lgpd-consent", "granted");
  const submitLead = load("https://r.test/fn");
  await submitLead({ ...fields, email: "", intent: "" });
  const b = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(b.visitor_id).toMatch(UUID);
  expect(b).not.toHaveProperty("email");
  expect(b).not.toHaveProperty("intent");
});

test("200 ok -> {ok:true, token} and token stored like identifyLead", async () => {
  const submitLead = load("https://r.test/fn");
  await expect(submitLead(fields)).resolves.toEqual({ ok: true, token: "tok-1" });
  expect(sessionStorage.getItem("radar_lead_token")).toBe("tok-1");
});

test.each([
  [400, "invalid_phone", { ok: false, error: "invalid_phone" }],
  [429, "rate_limited", { ok: false, error: "rate_limited" }],
  [500, "server_error", { ok: false }],
  [404, "server_error", null],
  [200, "server_error", { ok: true }], // no token = not a success
])("HTTP %i -> {ok:false, error:'%s'}, no token stored", async (status, error, body) => {
  global.fetch = jest.fn(() => res(status, body));
  const submitLead = load("https://r.test/fn");
  await expect(submitLead(fields)).resolves.toEqual({ ok: false, error });
  expect(sessionStorage.getItem("radar_lead_token")).toBeNull();
});

test("network failure -> {ok:false, error:'network'}", async () => {
  global.fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));
  const submitLead = load("https://r.test/fn");
  await expect(submitLead(fields)).resolves.toEqual({ ok: false, error: "network" });
});

test("no answer within 8s -> {ok:false, error:'timeout'} and the request is aborted", async () => {
  jest.useFakeTimers();
  let signal;
  global.fetch = jest.fn((u, init) => { signal = init.signal; return new Promise(() => {}); });
  const submitLead = load("https://r.test/fn");
  let out;
  submitLead(fields).then((r) => { out = r; });
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  jest.advanceTimersByTime(7900);
  await flush();
  expect(out).toBeUndefined();
  jest.advanceTimersByTime(200);
  await flush();
  expect(out).toEqual({ ok: false, error: "timeout" });
  expect(signal.aborted).toBe(true);
});

test("radar disabled (no URL) -> {ok:false, error:'disabled'} without fetch", async () => {
  const submitLead = load("");
  await expect(submitLead(fields)).resolves.toEqual({ ok: false, error: "disabled" });
  expect(global.fetch).not.toHaveBeenCalled();
});
