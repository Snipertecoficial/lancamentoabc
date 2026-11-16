import { assertEquals } from "jsr:@std/assert@1";
import { corsHeaders, isAllowedOrigin } from "./cors.ts";

const P = ["https://lancamentoabc-*.vercel.app"];
Deno.test("isAllowedOrigin", () => {
  assertEquals(isAllowedOrigin("https://lancamentoabc-git-radar-x.vercel.app", P), true);
  assertEquals(isAllowedOrigin("https://evil.com", P), false);
  assertEquals(isAllowedOrigin("https://evil.com/https://lancamentoabc-x.vercel.app", P), false);
  assertEquals(isAllowedOrigin(null, P), false);
});
Deno.test("corsHeaders", () => {
  assertEquals(corsHeaders("https://evil.com", P).get("access-control-allow-origin"), null);
  assertEquals(
    corsHeaders("https://lancamentoabc-a.vercel.app", P).get("access-control-allow-origin"),
    "https://lancamentoabc-a.vercel.app",
  );
});
