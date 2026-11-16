import { createDb } from "../_shared/db.ts";
import { handleConfirmLead } from "./handler.ts";

const db = createDb(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const allowedOrigins = (Deno.env.get("RADAR_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

Deno.serve((req) => handleConfirmLead(req, { consume: db.consumeLeadToken, allowedOrigins }));
