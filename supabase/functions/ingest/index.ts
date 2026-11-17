import { createDb } from "../_shared/db.ts";
import { allowedOrigins, ipSalt } from "../_shared/config.ts";
import { handleIngest } from "./handler.ts";

const env = (k: string) => Deno.env.get(k);
const db = createDb(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const deps = { ...db, allowedOrigins: allowedOrigins(env), ipSalt: await ipSalt(env) };

Deno.serve((req) => handleIngest(req, deps));
