import { createClient } from "npm:@supabase/supabase-js@2";
import type { Batch, RadarEvent } from "./envelope.ts";

// Campos de atribuição (sem device/screen/lang) guardados em visitors.first_touch/last_touch.
const TOUCH_KEYS = [
  "landing_url", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "gbraid", "wbraid", "fbclid", "keyword", "matchtype", "campaign_id", "adgroup_id",
] as const;

function touchOf(b: Batch): Record<string, string> {
  const t: Record<string, string> = {};
  for (const k of TOUCH_KEYS) {
    const v = b.session[k];
    if (v) t[k] = v;
  }
  return t;
}

const firstTs = (b: Batch, fallback: string) =>
  b.events.map((e) => e.ts).sort()[0] ?? fallback;

export function createDb(url: string, serviceRoleKey: string) {
  const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  return {
    async upsertSession(b: Batch, ipHash: string, isBot: boolean, userAgent: string | null) {
      // Atômico (SQL upsert_session): cria a sessão; se já existe, só preenche meta NULL e avança last_event_at.
      check((await sb.rpc("upsert_session", {
        p: {
          ...b.session,
          id: b.session_id,
          visitor_id: b.visitor_id,
          env: b.env,
          started_at: firstTs(b, new Date().toISOString()),
          user_agent: userAgent,
          ip_hash: ipHash,
          is_bot: isBot,
        },
      })).error);
    },

    async upsertVisitor(b: Batch) {
      if (!b.visitor_id) return;
      const now = new Date().toISOString();
      const touch = touchOf(b);
      check((await sb.from("visitors").upsert({
        id: b.visitor_id,
        env: b.env,
        first_seen_at: now,
        last_seen_at: now,
        first_touch: touch,
        last_touch: touch,
      }, { onConflict: "id", ignoreDuplicates: true })).error);
      const patch: Record<string, unknown> = { last_seen_at: now };
      if (Object.keys(touch).length > 0) patch.last_touch = touch;
      check((await sb.from("visitors").update(patch).eq("id", b.visitor_id)).error);
    },

    async insertEvents(b: Batch, events: RadarEvent[]) {
      const rows = events.map((e) => ({
        id: e.id,
        session_id: b.session_id,
        visitor_id: b.visitor_id,
        type: e.type,
        name: e.name ?? null,
        section: e.section ?? null,
        props: e.props ?? {},
        occurred_at: e.ts,
      }));
      check((await sb.from("events").upsert(rows, { onConflict: "id", ignoreDuplicates: true })).error);
    },

    async recordLead(args: {
      env: string;
      phone_e164: string | null;
      phone_raw: string | null;
      name: string | null;
      email: string | null;
      session_id: string;
      visitor_id: string | null;
      lead_token: string;
    }): Promise<string> {
      const { data, error } = await sb.rpc("record_lead", {
        p_env: args.env,
        p_phone_e164: args.phone_e164,
        p_phone_raw: args.phone_raw,
        p_name: args.name,
        p_email: args.email,
        p_session_id: args.session_id,
        p_visitor_id: args.visitor_id,
        p_lead_token: args.lead_token,
      });
      check(error);
      return data as string;
    },

    /** Envios `lead_submitted` na última hora com o mesmo ip_hash (rate limit). */
    async countRecentLeadSubmissions(ipHash: string): Promise<number> {
      const since = new Date(Date.now() - 3600_000).toISOString();
      // ip_hash vem do evento (hash do request), não da sessão: reutilizar session_id não burla o limite.
      const { count, error } = await sb.from("events")
        .select("id", { count: "exact", head: true })
        .eq("type", "lead_submitted")
        .eq("props->>ip_hash", ipHash)
        .gt("received_at", since);
      check(error);
      return count ?? 0;
    },

    async markWhatsapp(token: string): Promise<void> {
      check((await sb.rpc("mark_lead_whatsapp", { p_token: token })).error);
    },

    async consumeLeadToken(token: string): Promise<
      { first_use: boolean; phone_e164: string | null; email: string | null } | null
    > {
      const { data, error } = await sb.rpc("consume_lead_token", { p_token: token });
      check(error);
      return (data as { first_use: boolean; phone_e164: string | null; email: string | null }[] | null)?.[0] ?? null;
    },

    async storeRdRaw(payload: unknown): Promise<number> {
      const { data, error } = await sb.from("rd_webhook_raw").insert({ payload }).select("id").single();
      check(error);
      return (data as { id: number }).id;
    },

    async finishRdRaw(rawId: number, ids: string[], error: string | null): Promise<void> {
      check((await sb.from("rd_webhook_raw")
        .update({ matched_lead_ids: ids, error }).eq("id", rawId)).error);
    },

    async confirmRdLead(lead: {
      phone_e164: string | null;
      email: string | null;
      name: string | null;
      rd_lead_id: string | null;
    }): Promise<string> {
      const { data, error } = await sb.rpc("confirm_rd_lead", {
        p_phone_e164: lead.phone_e164,
        p_email: lead.email,
        p_name: lead.name,
        p_rd_lead_id: lead.rd_lead_id,
      });
      check(error);
      return data as string;
    },
  };
}
