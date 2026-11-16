import { createDb } from "../_shared/db.ts";
import { handleRdWebhook } from "./handler.ts";

const db = createDb(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const secret = Deno.env.get("RD_WEBHOOK_SECRET") ?? "";

Deno.serve((req) =>
  handleRdWebhook(req, {
    secret,
    storeRaw: db.storeRdRaw,
    confirm: db.confirmRdLead,
    finish: db.finishRdRaw,
  })
);
