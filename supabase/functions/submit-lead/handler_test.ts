import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { handleSubmitLead, type SubmitLeadDeps } from "./handler.ts";
import { UUID_RE } from "../_shared/uuid.ts";
import { sha256Hex } from "../_shared/hash.ts";

const ORIGIN = "https://lancamento.espontone.com.br";
const SID = "11111111-1111-4111-8111-111111111111";
const VID = "22222222-2222-4222-8222-222222222222";

function fakeDeps(over: Partial<SubmitLeadDeps> = {}) {
  const calls = {
    order: [] as string[],
    session: [] as unknown[][],
    visitor: [] as unknown[],
    events: [] as unknown[][],
    lead: [] as Parameters<SubmitLeadDeps["recordLead"]>[0][],
    count: [] as string[],
  };
  const deps: SubmitLeadDeps = {
    upsertSession: (b, ipHash, bot, ua) => {
      calls.order.push("session");
      calls.session.push([b, ipHash, bot, ua]);
      return Promise.resolve();
    },
    upsertVisitor: (b) => {
      calls.order.push("visitor");
      calls.visitor.push(b);
      return Promise.resolve();
    },
    insertEvents: (b, events) => {
      calls.order.push("events");
      calls.events.push([b, events]);
      return Promise.resolve();
    },
    recordLead: (args) => {
      calls.order.push("lead");
      calls.lead.push(args);
      return Promise.resolve("lead-id");
    },
    countRecentLeadSubmissions: (ipHash) => {
      calls.order.push("count");
      calls.count.push(ipHash);
      return Promise.resolve(0);
    },
    allowedOrigins: [ORIGIN],
    ipSalt: "salt",
    ...over,
  };
  return { deps, calls };
}

const body = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    env: "staging", session_id: SID, visitor_id: VID, name: "  Maria Silva ",
    phone: "(11) 90000-0301", email: "m@x.com", intent: "morar", form_id: "hero",
    hp: "", elapsed_ms: 5000, ...over,
  });
const post = (b: string, headers: Record<string, string> = {}) =>
  new Request("http://x/submit-lead", {
    method: "POST",
    body: b,
    headers: {
      "content-type": "text/plain;charset=UTF-8", origin: ORIGIN,
      "user-agent": "Mozilla/5.0 (iPhone)", "x-forwarded-for": "1.2.3.4, 5.6.7.8", ...headers,
    },
  });
const json = async (r: Response) => await r.json();

Deno.test("valido: grava visitor, sessao, evento sem PII, depois recordLead; 200 com token", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleSubmitLead(post(body()), deps);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), ORIGIN);
  const out = await json(res);
  assertEquals(out.ok, true);
  assertEquals(UUID_RE.test(out.lead_token), true);
  assertEquals(calls.order, ["count", "visitor", "session", "events", "lead"]);
  const l = calls.lead[0];
  assertEquals(l.phone_e164, "+5511900000301");
  assertEquals(l.phone_raw, "(11) 90000-0301");
  assertEquals(l.name, "Maria Silva");
  assertEquals(l.email, "m@x.com");
  assertEquals(l.session_id, SID);
  assertEquals(l.visitor_id, VID);
  assertEquals(l.env, "staging");
  assertEquals(l.lead_token, out.lead_token);
  const [b, evs] = calls.events[0] as [{ session_id: string }, { type: string; props: Record<string, unknown> }[]];
  assertEquals(b.session_id, SID);
  assertEquals(evs.length, 1);
  assertEquals(evs[0].type, "lead_submitted");
  assertEquals(evs[0].props, { form_id: "hero", intent: "morar", lead_token: out.lead_token });
  assertEquals(JSON.stringify(evs[0]).includes("Maria"), false);
  assertEquals(JSON.stringify(evs[0]).includes("9000"), false);
});

Deno.test("ipHash: sha256 de ip + salt + data UTC; user-agent repassado", async () => {
  const { deps, calls } = fakeDeps();
  await handleSubmitLead(post(body()), deps);
  const expected = await sha256Hex("1.2.3.4" + "salt" + new Date().toISOString().slice(0, 10));
  assertEquals(calls.count[0], expected);
  assertEquals(calls.session[0][1], expected);
  assertEquals(calls.session[0][3], "Mozilla/5.0 (iPhone)");
});

Deno.test("visitor_id null: nao chama upsertVisitor", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleSubmitLead(post(body({ visitor_id: null })), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.order, ["count", "session", "events", "lead"]);
  assertEquals(calls.lead[0].visitor_id, null);
});

Deno.test("email e intent opcionais; intent invalido e ignorado", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleSubmitLead(post(body({ email: undefined, intent: "xyz" })), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.lead[0].email, null);
  const evs = (calls.events[0] as [unknown, { props: Record<string, unknown> }[]])[1];
  assertEquals("intent" in evs[0].props, false);
});

Deno.test("400 invalid_name (curto, longo, ausente)", async () => {
  for (const name of ["A", " ", "x".repeat(81), undefined, 5]) {
    const { deps, calls } = fakeDeps();
    const res = await handleSubmitLead(post(body({ name })), deps);
    assertEquals(res.status, 400);
    assertEquals(await json(res), { ok: false, error: "invalid_name" });
    assertEquals(calls.order.includes("lead"), false);
  }
});

Deno.test("400 invalid_phone", async () => {
  for (const phone of ["123", "", undefined, "abc"]) {
    const { deps } = fakeDeps();
    const res = await handleSubmitLead(post(body({ phone })), deps);
    assertEquals(res.status, 400);
    assertEquals(await json(res), { ok: false, error: "invalid_phone" });
  }
});

Deno.test("400 invalid_email", async () => {
  for (const email of ["nope", "a@b", "a b@c.com", 7]) {
    const { deps } = fakeDeps();
    const res = await handleSubmitLead(post(body({ email })), deps);
    assertEquals(res.status, 400);
    assertEquals(await json(res), { ok: false, error: "invalid_email" });
  }
});

Deno.test("400 invalid_request (env, session_id, visitor_id, json, form_id)", async () => {
  for (const b of [
    body({ env: "dev" }), body({ session_id: "x" }), body({ visitor_id: "x" }), body({ visitor_id: 3 }),
    "not json", "[]", body({ form_id: undefined }),
  ]) {
    const { deps } = fakeDeps();
    const res = await handleSubmitLead(post(b), deps);
    assertEquals(res.status, 400);
    assertEquals(await json(res), { ok: false, error: "invalid_request" });
  }
});

Deno.test("bot: honeypot preenchido -> 200 token falso sem nenhuma dep", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleSubmitLead(post(body({ hp: "http://spam" })), deps);
  assertEquals(res.status, 200);
  const out = await json(res);
  assertEquals(out.ok, true);
  assertEquals(UUID_RE.test(out.lead_token), true);
  assertEquals(calls.order, []);
});

Deno.test("bot: elapsed_ms < 2000 (ou ausente) -> 200 sem gravar, tokens distintos", async () => {
  const { deps, calls } = fakeDeps();
  const a = await json(await handleSubmitLead(post(body({ elapsed_ms: 1999 })), deps));
  const b = await json(await handleSubmitLead(post(body({ elapsed_ms: undefined })), deps));
  assertEquals(a.ok, true);
  assertEquals(b.ok, true);
  assertNotEquals(a.lead_token, b.lead_token);
  assertEquals(calls.order, []);
});

Deno.test("rate limit: >= 5 na ultima hora -> 429 sem gravar", async () => {
  const { deps, calls } = fakeDeps({ countRecentLeadSubmissions: () => Promise.resolve(5) });
  const res = await handleSubmitLead(post(body()), deps);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("access-control-allow-origin"), ORIGIN);
  assertEquals(await json(res), { ok: false, error: "rate_limited" });
  assertEquals(calls.order, []);
  const ok = fakeDeps({ countRecentLeadSubmissions: () => Promise.resolve(4) });
  assertEquals((await handleSubmitLead(post(body()), ok.deps)).status, 200);
});

Deno.test("recordLead lanca -> 500 {ok:false,error:server} com CORS", async () => {
  const { deps } = fakeDeps({ recordLead: () => Promise.reject(new Error("boom")) });
  const res = await handleSubmitLead(post(body()), deps);
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("access-control-allow-origin"), ORIGIN);
  assertEquals(await json(res), { ok: false, error: "server" });
});

Deno.test("qualquer outra dep lancando -> 500 server", async () => {
  for (const k of ["insertEvents", "upsertSession", "upsertVisitor", "countRecentLeadSubmissions"] as const) {
    const { deps } = fakeDeps({ [k]: () => Promise.reject(new Error("boom")) } as Partial<SubmitLeadDeps>);
    const res = await handleSubmitLead(post(body()), deps);
    assertEquals(res.status, 500);
    assertEquals(await json(res), { ok: false, error: "server" });
  }
});

Deno.test("OPTIONS -> 204 com CORS; GET -> 405; origem nao permitida sem header CORS", async () => {
  const { deps } = fakeDeps();
  const o = await handleSubmitLead(new Request("http://x/", { method: "OPTIONS", headers: { origin: ORIGIN } }), deps);
  assertEquals(o.status, 204);
  assertEquals(o.headers.get("access-control-allow-origin"), ORIGIN);
  const g = await handleSubmitLead(new Request("http://x/", { method: "GET", headers: { origin: ORIGIN } }), deps);
  assertEquals(g.status, 405);
  const bad = await handleSubmitLead(post(body(), { origin: "https://evil.com" }), deps);
  assertEquals(bad.headers.get("access-control-allow-origin"), null);
});
