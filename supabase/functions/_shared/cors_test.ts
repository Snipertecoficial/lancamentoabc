import { assertEquals } from "jsr:@std/assert@1";
import { corsHeaders, isAllowedOrigin } from "./cors.ts";
import { allowedOrigins } from "./config.ts";

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

Deno.test("corsHeaders: todas as origens de produção (http/https, com/sem www) ecoam; outras não", () => {
  const prod = [
    "https://lancamento.espontone.com.br",
    "http://lancamento.espontone.com.br",
    "https://www.lancamento.espontone.com.br",
    "http://www.lancamento.espontone.com.br",
  ];
  const patterns = allowedOrigins(() => undefined);
  for (const o of prod) assertEquals(corsHeaders(o, patterns).get("access-control-allow-origin"), o);
  for (const o of ["https://evil.example.com", "https://lancamento.espontone.com.br.evil.com", "https://xwww.lancamento.espontone.com.br"]) {
    assertEquals(corsHeaders(o, patterns).get("access-control-allow-origin"), null);
  }
});
