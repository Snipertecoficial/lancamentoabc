import { createClient } from "npm:@supabase/supabase-js@2";
import { handleAdsSync } from "./handler.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve((req) =>
  handleAdsSync(req, {
    secret: Deno.env.get("RADAR_ADS_SECRET"),
    async ingest(p) {
      const { data, error } = await sb.rpc("ads_ingest", { p });
      if (error) throw new Error(error.message);
      return data as Record<string, number>;
    },
  })
);
