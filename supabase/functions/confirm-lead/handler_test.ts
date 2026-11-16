import { assertEquals } from "jsr:@std/assert";
import { sha256Hex } from "../_shared/hash.ts";
import { handleConfirmLead } from "./handler.ts";

const TOKEN = "11111111-1111-4111-8111-111111111111";
const ORIGIN = "https://lp.example.com";

type Row = { first_use: boolean; phone_e164: string | null; email: string | null } | null;

function mk(row: Row, body: string = JSON.stringify({ lead_token: TOKEN }), method = "POST") {
  const calls: string[] = [];
  const deps = {
    consume: (t: string) => { calls.push(t); return Promise.resolve(row); },
    allowedOrigins: [ORIGIN],
  };
  const req = new Request("http://x/confirm-lead", {
    method,
    headers: { "content-type": "text/plain;charset=UTF-8", origin: ORIGIN },
    body: method === "POST" ? body : undefined,
  });
  return { calls, res: handleConfirmLead(req, deps) };
}

Deno.test("primeiro uso devolve user_data com hashes", async () => {
  const { res } = mk({ first_use: true, phone_e164: "+5511940383680", email: " T@X.com " });
  const r = await res;
  assertEquals(r.status, 200);
  assertEquals(r.headers.get("content-type"), "application/json");
  assertEquals(r.headers.get("access-control-allow-origin"), ORIGIN);
  const j = await r.json();
  assertEquals(j.ok, true);
  assertEquals(j.first_use, true);
  assertEquals(j.user_data.sha256_phone_number, await sha256Hex("+5511940383680"));
  assertEquals(j.user_data.sha256_email_address, await sha256Hex("t@x.com"));
});

Deno.test("primeiro uso sem e-mail -> email null", async () => {
  const { res } = mk({ first_use: true, phone_e164: "+5511940383680", email: null });
  const j = await (await res).json();
  assertEquals(j.user_data.sha256_email_address, null);
});

Deno.test("segundo uso -> first_use false, user_data null", async () => {
  const { res } = mk({ first_use: false, phone_e164: "+5511940383680", email: "a@b.com" });
  const r = await res;
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true, first_use: false, user_data: null });
});

Deno.test("token inexistente -> 404", async () => {
  const { res } = mk(null);
  const r = await res;
  assertEquals(r.status, 404);
  assertEquals(await r.json(), { ok: false });
});

Deno.test("corpo inválido -> 400 sem consumir", async () => {
  for (const body of ["not json", "{}", JSON.stringify({ lead_token: "abc" }), JSON.stringify({ lead_token: 5 })]) {
    const { res, calls } = mk(null, body);
    assertEquals((await res).status, 400);
    assertEquals(calls.length, 0);
  }
});

Deno.test("OPTIONS -> 204 com CORS", async () => {
  const { res } = mk(null, "", "OPTIONS");
  const r = await res;
  assertEquals(r.status, 204);
  assertEquals(r.headers.get("access-control-allow-origin"), ORIGIN);
});

Deno.test("consume que lança -> 500 {ok:false} com CORS", async () => {
  const req = new Request("http://x/confirm-lead", {
    method: "POST",
    headers: { origin: ORIGIN },
    body: JSON.stringify({ lead_token: TOKEN }),
  });
  const orig = console.error;
  console.error = () => {};
  try {
    const r = await handleConfirmLead(req, {
      consume: () => Promise.reject(new Error("db down")),
      allowedOrigins: [ORIGIN],
    });
    assertEquals(r.status, 500);
    assertEquals(await r.json(), { ok: false });
    assertEquals(r.headers.get("access-control-allow-origin"), ORIGIN);
  } finally {
    console.error = orig;
  }
});
