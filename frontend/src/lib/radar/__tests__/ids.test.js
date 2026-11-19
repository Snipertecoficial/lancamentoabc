import { uuid, getSessionId, getVisitorId, chatCode } from "../ids";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.cookie = "rdr_vid=; max-age=0";
});

test("uuid generates v4 format", () => {
  expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("visitor id only with consent, persisted in cookie", () => {
  expect(getVisitorId(false)).toBeNull();
  const v = getVisitorId(true);
  expect(getVisitorId(true)).toBe(v);
  expect(document.cookie).toMatch(/rdr_vid=/);
});

test("session id renews after 30 min of inactivity", () => {
  const s = getSessionId(0);
  expect(getSessionId(29 * 60e3)).toBe(s);
  expect(getSessionId(29 * 60e3 + 31 * 60e3)).not.toBe(s);
});

test("chatCode: first 6 hex chars of the session id, uppercase, stable within the session", () => {
  const sid = getSessionId(0);
  const code = chatCode(60e3);
  expect(code).toMatch(/^[0-9A-F]{6}$/);
  expect(code).toBe(sid.replace(/-/g, "").slice(0, 6).toUpperCase());
  expect(chatCode(120e3)).toBe(code);
});
