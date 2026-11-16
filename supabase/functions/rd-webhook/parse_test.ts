import { assertEquals } from "jsr:@std/assert";
import { parseRdPayload } from "./parse.ts";

const fixture = JSON.parse(
  await Deno.readTextFile(new URL("./fixtures/rd_conversion.json", import.meta.url)),
);

Deno.test("fixture -> 1 lead com telefone mobile", () => {
  assertEquals(parseRdPayload(fixture), [{
    name: "Maria Silva",
    email: "maria.silva@example.com",
    phone_raw: "(11) 94038-3680",
    rd_lead_id: "7254031",
  }]);
});

Deno.test("sem mobile_phone usa personal_phone", () => {
  const r = parseRdPayload({ leads: [{ id: 9, email: "a@b.com", mobile_phone: null, personal_phone: "1133334444" }] });
  assertEquals(r, [{ name: null, email: "a@b.com", phone_raw: "1133334444", rd_lead_id: "9" }]);
});

Deno.test("formatos inesperados -> []", () => {
  for (const b of [null, undefined, "x", 5, [], {}, { leads: "x" }, { leads: {} }]) {
    assertEquals(parseRdPayload(b), []);
  }
});

Deno.test("itens inválidos em leads são ignorados", () => {
  assertEquals(parseRdPayload({ leads: [null, 3, "x", { id: "1" }] }).length, 1);
});
