import { assertEquals } from "jsr:@std/assert";
import { handleRdWebhook, type RdConfirmLead } from "./handler.ts";

const fixtureText = await Deno.readTextFile(new URL("./fixtures/rd_conversion.json", import.meta.url));
const SECRET = "s3cret";

function mk(opts: { url?: string; body?: string; secret?: string; confirmErr?: boolean; method?: string } = {}) {
  const stored: unknown[] = [];
  const confirmed: RdConfirmLead[] = [];
  const finished: { id: number; ids: string[]; error: string | null }[] = [];
  const deps = {
    secret: opts.secret ?? SECRET,
    storeRaw: (p: unknown) => { stored.push(p); return Promise.resolve(42); },
    confirm: (l: RdConfirmLead) => {
      confirmed.push(l);
      return opts.confirmErr ? Promise.reject(new Error("db down")) : Promise.resolve("lead-uuid-1");
    },
    finish: (id: number, ids: string[], error: string | null) => {
      finished.push({ id, ids, error });
      return Promise.resolve();
    },
  };
  const req = new Request(opts.url ?? `http://x/rd-webhook?secret=${SECRET}`, {
    method: opts.method ?? "POST",
    body: opts.body ?? fixtureText,
  });
  return { stored, confirmed, finished, res: () => handleRdWebhook(req, deps) };
}

Deno.test("fixture -> confirm com telefone normalizado, finish com ids", async () => {
  const t = mk();
  const r = await t.res();
  assertEquals(r.status, 200);
  assertEquals(t.stored.length, 1);
  assertEquals(t.confirmed, [{
    name: "Maria Silva",
    email: "maria.silva@example.com",
    phone_e164: "+5511940383680",
    rd_lead_id: "7254031",
  }]);
  assertEquals(t.finished, [{ id: 42, ids: ["lead-uuid-1"], error: null }]);
});

Deno.test("payload repetido -> confirm chamado de novo", async () => {
  const t = mk();
  await t.res();
  const t2 = mk();
  await t2.res();
  assertEquals(t.confirmed.length, 1);
  assertEquals(t2.confirmed.length, 1);
});

Deno.test("segredo errado, ausente ou vazio -> 401 sem gravar", async () => {
  for (
    const t of [
      mk({ url: "http://x/rd-webhook?secret=errado" }),
      mk({ url: "http://x/rd-webhook" }),
      mk({ url: "http://x/rd-webhook?secret=", secret: "" }),
      mk({ url: "http://x/rd-webhook", secret: "" }),
    ]
  ) {
    assertEquals((await t.res()).status, 401);
    assertEquals(t.stored.length, 0);
    assertEquals(t.confirmed.length, 0);
  }
});

Deno.test("{} -> 200 sem confirm", async () => {
  const t = mk({ body: "{}" });
  assertEquals((await t.res()).status, 200);
  assertEquals(t.confirmed.length, 0);
  assertEquals(t.finished, [{ id: 42, ids: [], error: null }]);
});

Deno.test("confirm lançando -> 200 e finish com error", async () => {
  const t = mk({ confirmErr: true });
  assertEquals((await t.res()).status, 200);
  assertEquals(t.finished, [{ id: 42, ids: [], error: "db down" }]);
});

Deno.test("JSON inválido -> grava {_raw}, error invalid_json, 200", async () => {
  const t = mk({ body: "not json" });
  assertEquals((await t.res()).status, 200);
  assertEquals(t.stored, [{ _raw: "not json" }]);
  assertEquals(t.finished, [{ id: 42, ids: [], error: "invalid_json" }]);
});

Deno.test("lead sem telefone e sem e-mail é pulado", async () => {
  const t = mk({ body: JSON.stringify({ leads: [{ id: 1, name: "X" }] }) });
  assertEquals((await t.res()).status, 200);
  assertEquals(t.confirmed.length, 0);
});

Deno.test("storeRaw lançando -> ainda 200, sem confirm", async () => {
  const req = new Request(`http://x/rd-webhook?secret=${SECRET}`, { method: "POST", body: fixtureText });
  let confirmed = 0;
  const orig = console.error;
  console.error = () => {};
  try {
    const r = await handleRdWebhook(req, {
      secret: SECRET,
      storeRaw: () => Promise.reject(new Error("down")),
      confirm: () => { confirmed++; return Promise.resolve("x"); },
      finish: () => Promise.resolve(),
    });
    assertEquals(r.status, 200);
    assertEquals(confirmed, 0);
  } finally {
    console.error = orig;
  }
});
