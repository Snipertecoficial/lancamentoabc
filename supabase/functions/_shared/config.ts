import { sha256Hex } from "./hash.ts";

export const DEFAULT_ALLOWED_ORIGINS = [
  "https://lancamento.espontone.com.br",
  "http://localhost:3000",
];

export type EnvGetter = (key: string) => string | undefined;

export function allowedOrigins(env: EnvGetter): string[] {
  const list = (env("RADAR_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [...DEFAULT_ALLOWED_ORIGINS];
}

/** RADAR_IP_SALT if set; otherwise derived from the platform-provided service key (never logged). */
export async function ipSalt(env: EnvGetter): Promise<string> {
  const explicit = (env("RADAR_IP_SALT") ?? "").trim();
  if (explicit) return explicit;
  return await sha256Hex("radar-ip-salt:" + (env("SUPABASE_SERVICE_ROLE_KEY") ?? ""));
}
