import { createDb } from "../_shared/db.ts";
import { allowedOrigins } from "../_shared/config.ts";
import { handleConfirmLead } from "./handler.ts";

const db = createDb(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const origins = allowedOrigins((k) => Deno.env.get(k));

Deno.serve((req) => handleConfirmLead(req, { consume: db.consumeLeadToken, allowedOrigins: origins }));
