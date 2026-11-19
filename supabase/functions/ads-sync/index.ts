import { createClient } from "npm:@supabase/supabase-js@2";
import { handleAdsSync } from "./handler.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

Deno.serve((req) =>
  handleAdsSync(req, {
    secret: Deno.env.get("RADAR_ADS_SECRET"),
    ingest: (p) => rpc<Record<string, number>>("ads_ingest", { p }),
    ingestState: (p) => rpc<Record<string, number>>("ads_state_ingest", { p }),
    report: (cust, results) => rpc<number>("ads_commands_report", { cust, results }),
    claim: (cust) => rpc<unknown[]>("ads_commands_claim", { cust }),
    ingestReports: (cust, reports) => rpc<number>("ads_reports_ingest", { cust, reports }),
  })
);
