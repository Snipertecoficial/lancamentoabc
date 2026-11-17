import { formatPhoneBR, waLink, formatDateTimeBR, formatShortDateTimeBR, relativeTimeBR } from "../lib/format";

describe("formatPhoneBR", () => {
  test("mobile E.164 -> (11) 94038-3680", () => {
    expect(formatPhoneBR("+5511940383680")).toBe("(11) 94038-3680");
  });
  test("landline E.164 -> (11) 3234-5678", () => {
    expect(formatPhoneBR("+551132345678")).toBe("(11) 3234-5678");
  });
  test("national digits without +55 are formatted too", () => {
    expect(formatPhoneBR("11940383680")).toBe("(11) 94038-3680");
  });
  test("empty -> empty string; unknown shape is returned as is", () => {
    expect(formatPhoneBR(null)).toBe("");
    expect(formatPhoneBR("")).toBe("");
    expect(formatPhoneBR("+14155550100")).toBe("+14155550100");
  });
});

describe("waLink", () => {
  test("keeps only digits", () => {
    expect(waLink("+5511940383680")).toBe("https://wa.me/5511940383680");
  });
  test("null without a phone", () => {
    expect(waLink(null)).toBeNull();
    expect(waLink("")).toBeNull();
  });
});

describe("formatDateTimeBR (America/Sao_Paulo)", () => {
  test("UTC instant shown in Sao Paulo time, dd/mm/yyyy HH:MM", () => {
    // 2026-11-17 00:04 UTC = 16/11/2026 21:04 in Sao Paulo (UTC-3)
    expect(formatDateTimeBR("2026-11-17T00:04:00Z")).toBe("16/11/2026 21:04");
  });
  test("uses the tz database, not a fixed -03:00 (Brazil had DST in Jan 2018: UTC-2)", () => {
    expect(formatDateTimeBR("2018-01-15T12:00:00Z")).toBe("15/01/2018 10:00");
  });
  test("midnight is 00, not 24", () => {
    expect(formatDateTimeBR("2026-11-17T03:00:00Z")).toBe("17/11/2026 00:00");
  });
  test("empty / invalid -> empty string", () => {
    expect(formatDateTimeBR(null)).toBe("");
    expect(formatDateTimeBR("nope")).toBe("");
  });
  test("short form dd/mm HH:MM", () => {
    expect(formatShortDateTimeBR("2026-11-17T00:04:00Z")).toBe("16/11 21:04");
  });
});

describe("relativeTimeBR", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();
  test("under a minute -> agora (future too)", () => {
    expect(relativeTimeBR(ago(20 * 1000), now)).toBe("agora");
    expect(relativeTimeBR(ago(-60 * 1000), now)).toBe("agora");
  });
  test("minutes, hours, days", () => {
    expect(relativeTimeBR(ago(5 * 60 * 1000), now)).toBe("há 5 min");
    expect(relativeTimeBR(ago(3 * 3600 * 1000), now)).toBe("há 3 h");
    expect(relativeTimeBR(ago(26 * 3600 * 1000), now)).toBe("há 1 dia");
    expect(relativeTimeBR(ago(4 * 86400 * 1000), now)).toBe("há 4 dias");
  });
  test("30 days or more -> the date in Sao Paulo", () => {
    expect(relativeTimeBR("2026-09-01T02:00:00Z", now)).toBe("31/08/2026");
  });
  test("empty -> empty string", () => {
    expect(relativeTimeBR(null, now)).toBe("");
  });
});
