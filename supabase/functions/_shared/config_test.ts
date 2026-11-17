import { assertEquals, assertNotEquals, assertMatch } from "jsr:@std/assert@1";
import { allowedOrigins, DEFAULT_ALLOWED_ORIGINS, ipSalt } from "./config.ts";

const DEFAULTS = ["https://lancamento.espontone.com.br", "http://localhost:3000"];
const env = (o: Record<string, string>) => (k: string) => o[k];

Deno.test("allowedOrigins: default when unset or empty", () => {
  assertEquals(DEFAULT_ALLOWED_ORIGINS, DEFAULTS);
  assertEquals(allowedOrigins(env({})), DEFAULTS);
  assertEquals(allowedOrigins(env({ RADAR_ALLOWED_ORIGINS: "" })), DEFAULTS);
  assertEquals(allowedOrigins(env({ RADAR_ALLOWED_ORIGINS: " , " })), DEFAULTS);
});

Deno.test("allowedOrigins: parses comma-separated env, trimmed", () => {
  assertEquals(
    allowedOrigins(env({ RADAR_ALLOWED_ORIGINS: " https://a.com , https://b-*.vercel.app,," })),
    ["https://a.com", "https://b-*.vercel.app"],
  );
});

Deno.test("ipSalt: derived when unset, deterministic, not the key, 64 hex", async () => {
  const e = env({ SUPABASE_SERVICE_ROLE_KEY: "service-key-123" });
  const a = await ipSalt(e);
  assertMatch(a, /^[0-9a-f]{64}$/);
  assertNotEquals(a, "service-key-123");
  assertEquals(await ipSalt(e), a);
  assertEquals(await ipSalt(env({ SUPABASE_SERVICE_ROLE_KEY: "service-key-123", RADAR_IP_SALT: "" })), a);
  assertNotEquals(await ipSalt(env({ SUPABASE_SERVICE_ROLE_KEY: "other" })), a);
});

Deno.test("ipSalt: env salt used when set", async () => {
  assertEquals(await ipSalt(env({ RADAR_IP_SALT: "my-salt", SUPABASE_SERVICE_ROLE_KEY: "k" })), "my-salt");
});
