import { assertEquals } from "jsr:@std/assert@1";
import { parseBatch } from "./envelope.ts";

const now = new Date("2026-11-16T12:00:00Z");
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);

function ev(i: number, type = "page_view", ts = now.toISOString()) {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  return { id, type, ts };
}
function make(events: unknown[], over: Record<string, unknown> = {}) {
  return JSON.stringify({
    v: 1, env: "staging", session_id: U1, visitor_id: U2,
    session: { landing_url: "https://x.com/", lang: "pt-BR" },
    events, ...over,
  });
}
const batchWith = (n: number) => make(Array.from({ length: n }, (_, i) => ev(i + 1)));
const batchWithTypes = (types: string[]) => make(types.map((t, i) => ev(i + 1, t)));
const batchWithTs = (d: Date) => make([ev(1, "page_view", d.toISOString())]);

Deno.test("rejeita JSON inválido, corpo grande e > 50 eventos", () => {
  assertEquals(parseBatch("{", now).ok, false);
  assertEquals(parseBatch("x".repeat(65537), now).ok, false);
  assertEquals(parseBatch(batchWith(51), now).ok, false);
  assertEquals(parseBatch(batchWith(50), now).ok, true);
});
Deno.test("rejeita v, env e UUIDs inválidos", () => {
  assertEquals(parseBatch(make([], { v: 2 }), now).ok, false);
  assertEquals(parseBatch(make([], { env: "dev" }), now).ok, false);
  assertEquals(parseBatch(make([], { session_id: "nope" }), now).ok, false);
  assertEquals(parseBatch(make([], { visitor_id: "nope" }), now).ok, false);
  assertEquals(parseBatch(make([], { visitor_id: null }), now).ok, true);
});
Deno.test("descarta tipo desconhecido", () => {
  const r = parseBatch(batchWithTypes(["page_view", "hack"]), now);
  assertEquals([r.ok, r.ok && r.batch.events.length, r.ok && r.dropped], [true, 1, 1]);
});
Deno.test("descarta evento > 24h no futuro", () => {
  const f = parseBatch(batchWithTs(addHours(now, 25)), now);
  assertEquals([f.ok, f.ok && f.dropped], [true, 1]);
  const g = parseBatch(batchWithTs(addHours(now, 23)), now);
  assertEquals([g.ok, g.ok && g.dropped], [true, 0]);
});

Deno.test("parseSessionMeta: só chaves conhecidas com valor string; não-objeto vira {}", async () => {
  const { parseSessionMeta } = await import("./envelope.ts");
  assertEquals(parseSessionMeta({ gclid: "G", utm_source: 1, x: "y", lang: "pt" }), { gclid: "G", lang: "pt" });
  assertEquals(parseSessionMeta(null), {});
  assertEquals(parseSessionMeta([1]), {});
});
