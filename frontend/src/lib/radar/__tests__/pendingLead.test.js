const fields = {
  name: "Ana Souza", phone: "+5511999999999", email: "", intent: "",
  formId: "modal-hero_cta_whatsapp", hp: "", elapsedMs: 5123,
};
const res = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
const readBlob = (blob) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsText(blob);
});

function load(url = "https://r.test/fn") {
  jest.resetModules();
  if (url) process.env.REACT_APP_RADAR_URL = url;
  else delete process.env.REACT_APP_RADAR_URL;
  return {
    pending: require("../pendingLead"),
    submitLead: require("../submitLead").submitLead,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  global.fetch = jest.fn(() => res(200, { ok: true, lead_token: "tok-retry" }));
  navigator.sendBeacon = jest.fn(() => true);
});
afterEach(() => { delete navigator.sendBeacon; });

test("isRescuable: only failures without a definitive server answer", () => {
  const { pending } = load();
  ["network", "timeout", "server", "server_error"].forEach((e) => expect(pending.isRescuable(e)).toBe(true));
  ["rate_limited", "invalid_phone", "invalid_name", "invalid_email", "invalid_request", "disabled", undefined]
    .forEach((e) => expect(pending.isRescuable(e)).toBe(false));
});

test("rescueLead: beacon to submit-lead with exactly submitLead's body; fields kept in sessionStorage only", async () => {
  const { pending, submitLead } = load();
  await submitLead(fields); // the body a normal submit sends
  const sent = JSON.parse(global.fetch.mock.calls[0][1].body);
  pending.rescueLead(fields);
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  const [url, blob] = navigator.sendBeacon.mock.calls[0];
  expect(url).toBe("https://r.test/fn/submit-lead");
  expect(blob.type).toBe("text/plain;charset=utf-8");
  expect(JSON.parse(await readBlob(blob))).toEqual(sent);
  expect(JSON.parse(sessionStorage.getItem(pending.PENDING_KEY))).toEqual(fields);
  expect(localStorage.length).toBe(0);
});

test("rescueLead without sendBeacon still keeps the pending lead", () => {
  delete navigator.sendBeacon;
  const { pending } = load();
  pending.rescueLead(fields);
  expect(sessionStorage.getItem(pending.PENDING_KEY)).not.toBeNull();
});

test("retryPendingLead: sends the pending lead once and clears it", async () => {
  const { pending } = load();
  sessionStorage.setItem(pending.PENDING_KEY, JSON.stringify(fields));
  await expect(pending.retryPendingLead()).resolves.toEqual({ ok: true, token: "tok-retry" });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
    name: "Ana Souza", phone: "+5511999999999", form_id: "modal-hero_cta_whatsapp", elapsed_ms: 5123,
  });
  expect(sessionStorage.getItem(pending.PENDING_KEY)).toBeNull();
  await expect(pending.retryPendingLead()).resolves.toBeNull(); // next load: nothing left
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("a failed retry is not stored again (one retry only) and fires no beacon", async () => {
  global.fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));
  const { pending } = load();
  sessionStorage.setItem(pending.PENDING_KEY, JSON.stringify(fields));
  await expect(pending.retryPendingLead()).resolves.toEqual({ ok: false, error: "network" });
  expect(sessionStorage.getItem(pending.PENDING_KEY)).toBeNull();
  expect(navigator.sendBeacon).not.toHaveBeenCalled();
});

test("nothing pending / corrupt value -> no request", async () => {
  const { pending } = load();
  await expect(pending.retryPendingLead()).resolves.toBeNull();
  sessionStorage.setItem(pending.PENDING_KEY, "{not json");
  await expect(pending.retryPendingLead()).resolves.toBeNull();
  expect(sessionStorage.getItem(pending.PENDING_KEY)).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("radar disabled (no RADAR_URL) -> rescue and retry are no-ops", async () => {
  const { pending } = load(null);
  pending.rescueLead(fields);
  expect(navigator.sendBeacon).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(pending.PENDING_KEY)).toBeNull();
  await expect(pending.retryPendingLead()).resolves.toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});
