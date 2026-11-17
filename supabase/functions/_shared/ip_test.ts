import { assertEquals } from "jsr:@std/assert@1";
import { clientIp, ipHashOf } from "./ip.ts";
import { sha256Hex } from "./hash.ts";

const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });

Deno.test("clientIp: cf-connecting-ip > x-real-ip > último x-forwarded-for", () => {
  assertEquals(clientIp(req({ "cf-connecting-ip": "9.9.9.9", "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "9.9.9.9");
  assertEquals(clientIp(req({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "8.8.8.8");
  assertEquals(clientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2 , 3.3.3.3" })), "3.3.3.3");
  assertEquals(clientIp(req({ "x-forwarded-for": "1.1.1.1" })), "1.1.1.1");
  assertEquals(clientIp(req({})), "");
});

Deno.test("ipHashOf: forjar o primeiro x-forwarded-for não muda o hash", async () => {
  const now = new Date("2026-11-17T10:00:00Z");
  const a = await ipHashOf(req({ "x-forwarded-for": "7.7.7.7" }), "s", now);
  const b = await ipHashOf(req({ "x-forwarded-for": "1.2.3.4, 7.7.7.7" }), "s", now);
  assertEquals(a, b);
  assertEquals(a, await sha256Hex("7.7.7.7" + "s" + "2026-11-17"));
});
