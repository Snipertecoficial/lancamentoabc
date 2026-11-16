import { assertEquals } from "jsr:@std/assert@1";
import { normalizePhoneBR } from "./phone.ts";

Deno.test("normalizePhoneBR: celular em vários formatos", () => {
  for (const raw of ["(11) 94038-3680", "11940383680", "+55 11 94038-3680", "011940383680", "5511940383680"]) {
    assertEquals(normalizePhoneBR(raw), "+5511940383680");
  }
});
Deno.test("normalizePhoneBR: fixo", () => {
  assertEquals(normalizePhoneBR("(11) 4038-3680"), "+551140383680");
});
Deno.test("normalizePhoneBR: inválido e nulo", () => {
  assertEquals(normalizePhoneBR("123"), null);
  assertEquals(normalizePhoneBR(null), null);
});
