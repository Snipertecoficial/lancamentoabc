import { sendBatch } from "../transport";

test("never throws, uses fetch", () => {
  global.fetch = jest.fn(() => Promise.reject(new Error("offline")));
  expect(() => sendBatch("u", "{}", false)).not.toThrow();
  expect(global.fetch.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
});

test("beacon", () => {
  navigator.sendBeacon = jest.fn(() => true);
  expect(sendBatch("u", "{}", true)).toBe(true);
  expect(navigator.sendBeacon.mock.calls[0][1].type.toLowerCase()).toBe("text/plain;charset=utf-8");
});

test("falls back to fetch when beacon throws", () => {
  navigator.sendBeacon = jest.fn(() => { throw new Error("x"); });
  global.fetch = jest.fn(() => Promise.resolve({}));
  expect(() => sendBatch("u", "{}", true)).not.toThrow();
  expect(global.fetch).toHaveBeenCalled();
});
