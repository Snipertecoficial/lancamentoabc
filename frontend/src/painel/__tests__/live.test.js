import { liveOrigin, liveSection } from "../lib/live";

test("origin from the landing URL click ids and utm (the live view has no referrer)", () => {
  expect(liveOrigin({ landing_url: "https://x.com/?gclid=ABC" })).toBe("google_ads");
  expect(liveOrigin({ landing_url: "https://x.com/?gbraid=1" })).toBe("google_ads");
  expect(liveOrigin({ landing_url: "https://x.com/?utm_source=google&utm_medium=cpc" })).toBe("google_ads");
  expect(liveOrigin({ landing_url: "https://x.com/?fbclid=IwAR" })).toBe("meta_ads");
  expect(liveOrigin({ landing_url: "https://x.com/?utm_source=instagram&utm_medium=paid_social" })).toBe("meta_ads");
  expect(liveOrigin({ utm_source: "newsletter", landing_url: "https://x.com/?utm_source=newsletter" })).toBe("other");
  expect(liveOrigin({ landing_url: "https://x.com/" })).toBe("unpaid");
  expect(liveOrigin({ landing_url: null })).toBe("unpaid");
  expect(liveOrigin({ landing_url: "not a url" })).toBe("unpaid");
});

test("section names in Portuguese", () => {
  expect(liveSection("top")).toBe("Topo/vídeo");
  expect(liveSection("faq")).toBe("Dúvidas");
  expect(liveSection("contato")).toBe("Formulário");
  expect(liveSection("galeria3d")).toBe("Galeria");
  expect(liveSection("something-new")).toBe("Outra parte da página");
  expect(liveSection(null)).toBe("");
});
