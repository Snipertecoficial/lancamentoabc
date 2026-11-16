import { assertEquals } from "jsr:@std/assert@1";
import { handleIngest, type IngestDeps } from "./handler.ts";
import type { Batch, RadarEvent } from "../_shared/envelope.ts";

const ORIGIN = "https://lancamentoabc-git-radar-x.vercel.app";
const SID = "11111111-1111-4111-8111-111111111111";
const VID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "33333333-3333-4333-8333-333333333333";
const nowIso = () => new Date().toISOString();
const evId = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

function fakeDeps() {
  const calls = {
    upsertSession: [] as unknown[][],
    upsertVisitor: [] as Batch[],
    insertEvents: [] as RadarEvent[][],
    recordLead: [] as Parameters<IngestDeps["recordLead"]>[0][],
    markWhatsapp: [] as string[],
    order: [] as string[],
  };
  const deps: IngestDeps = {
    upsertSession: (b, ipHash, bot, ua) => {
      calls.order.push("session");
      calls.upsertSession.push([b, ipHash, bot, ua]);
      return Promise.resolve();
    },
    upsertVisitor: (b) => {
      calls.order.push("visitor");
      calls.upsertVisitor.push(b);
      return Promise.resolve();
    },
    insertEvents: (_b, events) => {
      calls.order.push("events");
      calls.insertEvents.push(events);
      return Promise.resolve();
    },
    recordLead: (args) => {
      calls.order.push("lead");
      calls.recordLead.push(args);
      return Promise.resolve("lead-id");
    },
    markWhatsapp: (t) => {
      calls.order.push("whatsapp");
      calls.markWhatsapp.push(t);
      return Promise.resolve();
    },
    allowedOrigins: ["https://lancamentoabc-*.vercel.app"],
    ipSalt: "salt",
  };
  return { deps, calls };
}

function batch(events: unknown[], over: Record<string, unknown> = {}) {
  return JSON.stringify({
    v: 1, env: "staging", session_id: SID, visitor_id: VID,
    session: { landing_url: "https://x.com/", lang: "pt-BR" }, events, ...over,
  });
}
const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/ingest", {
    method: "POST",
    body,
    headers: { "content-type": "text/plain;charset=UTF-8", "user-agent": "Mozilla/5.0 (iPhone)", ...headers },
  });

const leadEvent = {
  id: evId(1), type: "lead_submitted", ts: nowIso(),
  props: {
    name: "Maria", phone: "(11) 94038-3680", email: "m@x.com",
    lead_token: TOKEN, form_id: "hero",
  },
};

Deno.test("lead_submitted: recordLead com telefone normalizado e evento sem PII", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleIngest(post(batch([leadEvent]), { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), deps);
  assertEquals(res.status, 204);
  assertEquals(calls.recordLead[0].phone_e164, "+5511940383680");
  assertEquals(calls.recordLead[0].phone_raw, "(11) 94038-3680");
  assertEquals(calls.recordLead[0].name, "Maria");
  assertEquals(calls.recordLead[0].email, "m@x.com");
  assertEquals(calls.recordLead[0].lead_token, TOKEN);
  assertEquals(calls.recordLead[0].session_id, SID);
  assertEquals(Object.keys(calls.insertEvents[0][0].props!).sort(), ["form_id", "lead_token"]);
  assertEquals(calls.order, ["visitor", "session", "events", "lead"]);
});

Deno.test("ipHash: sha256 de ip + salt + data UTC; bot detectado", async () => {
  const { deps, calls } = fakeDeps();
  await handleIngest(
    post(batch([{ id: evId(1), type: "page_view", ts: nowIso() }]), {
      "x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "Googlebot/2.1",
    }),
    deps,
  );
  const { sha256Hex } = await import("../_shared/hash.ts");
  const day = new Date().toISOString().slice(0, 10);
  assertEquals(calls.upsertSession[0][1], await sha256Hex("1.2.3.4" + "salt" + day));
  assertEquals(calls.upsertSession[0][2], true);
});

Deno.test("sem visitor_id: não chama upsertVisitor", async () => {
  const { deps, calls } = fakeDeps();
  await handleIngest(post(batch([{ id: evId(1), type: "page_view", ts: nowIso() }], { visitor_id: null })), deps);
  assertEquals(calls.upsertVisitor.length, 0);
  assertEquals(calls.insertEvents.length, 1);
});

Deno.test("whatsapp_click com lead_token chama markWhatsapp; sem token não", async () => {
  const { deps, calls } = fakeDeps();
  await handleIngest(
    post(batch([
      { id: evId(1), type: "whatsapp_click", ts: nowIso(), props: { lead_token: TOKEN } },
      { id: evId(2), type: "whatsapp_click", ts: nowIso() },
    ])),
    deps,
  );
  assertEquals(calls.markWhatsapp, [TOKEN]);
});

Deno.test("corpo inválido: 400 e nada gravado", async () => {
  const { deps, calls } = fakeDeps();
  const res = await handleIngest(post("{"), deps);
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid json");
  assertEquals(calls.insertEvents.length, 0);
  assertEquals(calls.upsertSession.length, 0);
});

Deno.test("deps lançando erro: 204, não 500", async () => {
  const { deps } = fakeDeps();
  const throwing: IngestDeps = { ...deps, insertEvents: () => Promise.reject(new Error("boom")) };
  const orig = console.error;
  console.error = () => {};
  try {
    const res = await handleIngest(post(batch([leadEvent])), throwing);
    assertEquals(res.status, 204);
  } finally {
    console.error = orig;
  }
});

Deno.test("OPTIONS de origem permitida: 204 com CORS; não permitida: sem header", async () => {
  const { deps } = fakeDeps();
  const ok = await handleIngest(new Request("http://x/ingest", { method: "OPTIONS", headers: { origin: ORIGIN } }), deps);
  assertEquals(ok.status, 204);
  assertEquals(ok.headers.get("access-control-allow-origin"), ORIGIN);
  const bad = await handleIngest(new Request("http://x/ingest", { method: "OPTIONS", headers: { origin: "https://evil.com" } }), deps);
  assertEquals(bad.status, 204);
  assertEquals(bad.headers.get("access-control-allow-origin"), null);
});

Deno.test("POST de origem permitida devolve CORS no 204", async () => {
  const { deps } = fakeDeps();
  const res = await handleIngest(post(batch([]), { origin: ORIGIN }), deps);
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), ORIGIN);
});

Deno.test("user-agent do request chega em upsertSession", async () => {
  const { deps, calls } = fakeDeps();
  await handleIngest(post(batch([]), { "user-agent": "Mozilla/5.0 (iPhone) Teste" }), deps);
  assertEquals(calls.upsertSession[0][3], "Mozilla/5.0 (iPhone) Teste");
});

Deno.test("lead_submitted sem lead_token: token gerado vai para recordLead e para props do evento", async () => {
  const { deps, calls } = fakeDeps();
  const { lead_token: _t, ...noToken } = leadEvent.props;
  await handleIngest(post(batch([{ ...leadEvent, props: noToken }])), deps);
  const token = calls.recordLead[0].lead_token;
  assertEquals(typeof token, "string");
  assertEquals(token.length > 0, true);
  assertEquals(calls.insertEvents[0][0].props!.lead_token, token);
  assertEquals(Object.keys(calls.insertEvents[0][0].props!).sort(), ["form_id", "lead_token"]);
});

async function quiet<T>(f: () => Promise<T>): Promise<T> {
  const orig = console.error;
  console.error = () => {};
  try {
    return await f();
  } finally {
    console.error = orig;
  }
}

Deno.test("insertEvents lança: recordLead ainda é chamado", async () => {
  const { deps, calls } = fakeDeps();
  const d: IngestDeps = { ...deps, insertEvents: () => Promise.reject(new Error("boom")) };
  const res = await quiet(() => handleIngest(post(batch([leadEvent])), d));
  assertEquals(res.status, 204);
  assertEquals(calls.recordLead.length, 1);
});

Deno.test("upsertSession e upsertVisitor lançam: eventos, leads e whatsapp ainda rodam", async () => {
  const { deps, calls } = fakeDeps();
  const d: IngestDeps = {
    ...deps,
    upsertSession: () => Promise.reject(new Error("s")),
    upsertVisitor: () => Promise.reject(new Error("v")),
  };
  const wa = { id: evId(2), type: "whatsapp_click", ts: nowIso(), props: { lead_token: TOKEN } };
  const res = await quiet(() => handleIngest(post(batch([leadEvent, wa])), d));
  assertEquals(res.status, 204);
  assertEquals(calls.insertEvents.length, 1);
  assertEquals(calls.recordLead.length, 1);
  assertEquals(calls.markWhatsapp, [TOKEN]);
});

Deno.test("primeiro recordLead lança: segundo lead e markWhatsapp continuam", async () => {
  const { deps, calls } = fakeDeps();
  const T2 = "44444444-4444-4444-8444-444444444444";
  let n = 0;
  const d: IngestDeps = {
    ...deps,
    recordLead: (a) => {
      if (n++ === 0) return Promise.reject(new Error("boom"));
      return deps.recordLead(a);
    },
  };
  const lead2 = { ...leadEvent, id: evId(2), props: { ...leadEvent.props, lead_token: T2 } };
  const wa = { id: evId(3), type: "whatsapp_click", ts: nowIso(), props: { lead_token: TOKEN } };
  const res = await quiet(() => handleIngest(post(batch([leadEvent, lead2, wa])), d));
  assertEquals(res.status, 204);
  assertEquals(calls.recordLead.map((l) => l.lead_token), [T2]);
  assertEquals(calls.markWhatsapp, [TOKEN]);
});

Deno.test("PII é removida de props de qualquer evento", async () => {
  const { deps, calls } = fakeDeps();
  const ev = {
    id: evId(1), type: "form_field_complete", ts: nowIso(),
    props: { field: "email", Email: "a@x.com", telefone: "11999999999", Nome: "x", "E-mail": "a@x.com", celular: "1", mobile_phone: "1", phone_raw: "1" },
  };
  await handleIngest(post(batch([ev])), deps);
  assertEquals(calls.insertEvents[0][0].props, { field: "email" });
});

Deno.test("lead_token inválido do cliente é tratado como ausente", async () => {
  const { deps, calls } = fakeDeps();
  const ev = { ...leadEvent, props: { ...leadEvent.props, lead_token: "not-a-uuid" } };
  await handleIngest(post(batch([ev])), deps);
  const token = calls.recordLead[0].lead_token;
  assertEquals(token === "not-a-uuid", false);
  assertEquals(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token), true);
  assertEquals(calls.insertEvents[0][0].props!.lead_token, token);
});
