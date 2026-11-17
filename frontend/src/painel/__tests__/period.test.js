import { todaySP, addDays, spMidnightIso, periodRange } from "../lib/period";

// 2026-11-17 02:30 UTC is still 16/11 23:30 in Sao Paulo.
const now = new Date("2026-11-17T02:30:00Z");

test("todaySP uses the Sao Paulo calendar day", () => {
  expect(todaySP(now)).toBe("2026-11-16");
});

test("addDays crosses months and years", () => {
  expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
});

test("spMidnightIso: Sao Paulo midnight as a UTC instant, DST-agnostic", () => {
  expect(spMidnightIso("2026-11-16")).toBe("2026-11-16T03:00:00.000Z");
  expect(spMidnightIso("2018-01-15")).toBe("2018-01-15T02:00:00.000Z");
  // 04/11/2018: DST began at local midnight (00:00 did not exist) -> the day starts at 01:00 local.
  expect(spMidnightIso("2018-11-04")).toBe("2018-11-04T03:00:00.000Z");
});

test("hoje = today only", () => {
  expect(periodRange({ period: "hoje" }, now)).toEqual({
    fromDay: "2026-11-16", toDay: "2026-11-16",
    fromIso: "2026-11-16T03:00:00.000Z", toIso: "2026-11-17T03:00:00.000Z",
  });
});

test("7d and 30d include today", () => {
  expect(periodRange({ period: "7d" }, now)).toMatchObject({ fromDay: "2026-11-10", toDay: "2026-11-16", fromIso: "2026-11-10T03:00:00.000Z" });
  expect(periodRange({ period: "30d" }, now)).toMatchObject({ fromDay: "2026-10-18", toDay: "2026-11-16" });
});

test("custom uses both dates inclusive and swaps a reversed range", () => {
  expect(periodRange({ period: "custom", from: "2026-11-01", to: "2026-11-05" }, now)).toEqual({
    fromDay: "2026-11-01", toDay: "2026-11-05",
    fromIso: "2026-11-01T03:00:00.000Z", toIso: "2026-11-06T03:00:00.000Z",
  });
  expect(periodRange({ period: "custom", from: "2026-11-05", to: "2026-11-01" }, now)).toMatchObject({ fromDay: "2026-11-01", toDay: "2026-11-05" });
});

test("custom with a missing date falls back to the other one (single day)", () => {
  expect(periodRange({ period: "custom", from: "2026-11-03", to: "" }, now)).toMatchObject({ fromDay: "2026-11-03", toDay: "2026-11-03" });
  expect(periodRange({ period: "custom", from: "", to: "" }, now)).toMatchObject({ fromDay: "2026-11-16", toDay: "2026-11-16" });
});
