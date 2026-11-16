import { readAttribution } from "../attribution";

const iPhoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const iPadUA = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120";

test("reads params, device and strips fragment", () => {
  const a = readAttribution("https://x.app/?utm_source=google&gclid=ABC&keyword=apartamento+sbc#faq", "", iPhoneUA, 375);
  expect(a).toMatchObject({
    utm_source: "google",
    gclid: "ABC",
    keyword: "apartamento sbc",
    device: "mobile",
    landing_url: "https://x.app/?utm_source=google&gclid=ABC&keyword=apartamento+sbc",
  });
});

test("tablet, desktop, screen and referrer", () => {
  expect(readAttribution("https://x.app/", "https://g.com/", iPadUA, 768).device).toBe("tablet");
  const d = readAttribution("https://x.app/", "https://g.com/", desktopUA, 1280);
  expect(d.device).toBe("desktop");
  expect(d.referrer).toBe("https://g.com/");
  expect(d.screen).toMatch(/^1280x\d+$/);
});

test("never throws on bad href", () => {
  expect(() => readAttribution("::", "", "", 0)).not.toThrow();
});
