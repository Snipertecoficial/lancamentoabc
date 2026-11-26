import { createDb } from "../_shared/db.ts";
import { allowedOrigins, ipSalt } from "../_shared/config.ts";
import { sendToRdCrm, type CrmLead } from "../_shared/rdcrm.ts";
import { handleSubmitLead } from "./handler.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const env = (k: string) => Deno.env.get(k);
const db = createDb(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const rdToken = env("RD_CRM_TOKEN");
// With the secret RD_CRM_TOKEN set, each production lead is also copied to RD Station CRM after the reply.
const forwardLead = rdToken
  ? (lead: CrmLead) => {
    const job = sendToRdCrm(rdToken, lead);
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job);
  }
  : undefined;
const deps = { ...db, forwardLead, allowedOrigins: allowedOrigins(env), ipSalt: await ipSalt(env) };

Deno.serve((req) => handleSubmitLead(req, deps));
