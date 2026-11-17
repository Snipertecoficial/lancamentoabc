import { createClient } from "@supabase/supabase-js";

// Publishable key is public by design; data access is enforced by RLS (admin only).
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: true, storageKey: "radar-painel-auth" } },
);
