import { ORIGINS, originLabel, originTone, AD_ORIGINS } from "../lib/origin";

test("labels for every origin the view produces", () => {
  expect(originLabel("google_ads")).toBe("Google Ads");
  expect(originLabel("meta_ads")).toBe("Meta Ads");
  expect(originLabel("organic_search")).toBe("Busca orgânica");
  expect(originLabel("direct")).toBe("Direto");
  expect(originLabel("other")).toBe("Outros");
});

test("unknown or empty origin -> Outros", () => {
  expect(originLabel(null)).toBe("Outros");
  expect(originLabel("tiktok")).toBe("Outros");
});

test("options list keeps the view order and each origin has its own color", () => {
  expect(ORIGINS.map((o) => o.value)).toEqual(["google_ads", "meta_ads", "organic_search", "direct", "other"]);
  const colors = ORIGINS.map((o) => originTone(o.value));
  expect(new Set(colors).size).toBe(colors.length);
  expect(originTone("nope")).toBe(originTone("other"));
});

test("ad origins are the two paid ones", () => {
  expect(AD_ORIGINS).toEqual(["google_ads", "meta_ads"]);
});
