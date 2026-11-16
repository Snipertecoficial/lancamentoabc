import { assertEquals } from "jsr:@std/assert@1";
import { isBot } from "./bot.ts";

Deno.test("isBot", () => {
  assertEquals(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assertEquals(isBot(null), true);
  assertEquals(isBot(""), true);
  assertEquals(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), false);
});
