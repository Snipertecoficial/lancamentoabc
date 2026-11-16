import { createDb } from "../_shared/db.ts";
import { handleIngest } from "./handler.ts";

const db = createDb(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const allowedOrigins = (Deno.env.get("RADAR_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ipSalt = Deno.env.get("RADAR_IP_SALT") ?? "";

Deno.serve((req) => handleIngest(req, { ...db, allowedOrigins, ipSalt }));
