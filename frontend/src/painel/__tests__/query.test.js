import { buildSearchFilter, applyLeadFilters } from "../lib/query";

describe("buildSearchFilter", () => {
  test("empty / blank -> null", () => {
    expect(buildSearchFilter("")).toBeNull();
    expect(buildSearchFilter("   ")).toBeNull();
    expect(buildSearchFilter(undefined)).toBeNull();
  });

  test("name and email ilike with a quoted pattern", () => {
    expect(buildSearchFilter(" Ana ")).toBe('name.ilike."%Ana%",email.ilike."%Ana%"');
  });

  test("digits also search the phone (formatting ignored)", () => {
    expect(buildSearchFilter("(11) 94038")).toBe(
      'name.ilike."%(11) 94038%",email.ilike."%(11) 94038%",phone_e164.ilike."%1194038%"',
    );
  });

  test("escapes LIKE wildcards and PostgREST delimiters", () => {
    // % and _ are escaped for LIKE (\% \_), then the backslash is escaped for the quoted PostgREST value.
    const f = buildSearchFilter('a%b_c,d(e)"f\\g');
    expect(f).toBe(String.raw`name.ilike."%a\\%b\\_c,d(e)\"f\\\\g%",email.ilike."%a\\%b\\_c,d(e)\"f\\\\g%"`);
  });

  test("drops * (PostgREST reads it as a wildcard)", () => {
    expect(buildSearchFilter("an*a")).toBe('name.ilike."%ana%",email.ilike."%ana%"');
    expect(buildSearchFilter("***")).toBeNull();
  });
});

function recorder() {
  const calls = [];
  const q = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); return q; } });
  return { q, calls };
}

test("applyLeadFilters always filters env and created_at range", () => {
  const { q, calls } = recorder();
  applyLeadFilters(q, { env: "production", fromIso: "A", toIso: "B" });
  expect(calls).toEqual([["eq", "env", "production"], ["gte", "created_at", "A"], ["lt", "created_at", "B"]]);
});

test("applyLeadFilters adds origin, stage and search when set", () => {
  const { q, calls } = recorder();
  applyLeadFilters(q, { env: "staging", fromIso: "A", toIso: "B", origin: "meta_ads", stage: "tentou", search: "Ana" });
  expect(calls.slice(3)).toEqual([
    ["eq", "origin", "meta_ads"],
    ["eq", "stage", "tentou"],
    ["or", 'name.ilike."%Ana%",email.ilike."%Ana%"'],
  ]);
});
