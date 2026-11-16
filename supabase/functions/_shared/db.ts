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
      const now = new Date().toISOString();
      const s = b.session;
      // 1) cria na primeira vez (started_at = 1º evento); no conflito não altera nada
      check((await sb.from("sessions").upsert({
        id: b.session_id,
        visitor_id: b.visitor_id,
        env: b.env,
        started_at: firstTs(b, now),
        last_event_at: now,
        landing_url: s.landing_url ?? null,
        referrer: s.referrer ?? null,
        utm_source: s.utm_source ?? null,
        utm_medium: s.utm_medium ?? null,
        utm_campaign: s.utm_campaign ?? null,
        utm_term: s.utm_term ?? null,
        utm_content: s.utm_content ?? null,
        gclid: s.gclid ?? null,
        gbraid: s.gbraid ?? null,
        wbraid: s.wbraid ?? null,
        fbclid: s.fbclid ?? null,
        keyword: s.keyword ?? null,
        matchtype: s.matchtype ?? null,
        campaign_id: s.campaign_id ?? null,
        adgroup_id: s.adgroup_id ?? null,
        device: s.device ?? null,
        screen: s.screen ?? null,
        lang: s.lang ?? null,
        user_agent: userAgent,
        ip_hash: ipHash,
        is_bot: isBot,
      }, { onConflict: "id", ignoreDuplicates: true })).error);
      // 2) avança last_event_at
      check((await sb.from("sessions").update({ last_event_at: now }).eq("id", b.session_id)).error);
      // 3) visitor_id = coalesce(visitor_id, novo)
      if (b.visitor_id) {
        check((await sb.from("sessions").update({ visitor_id: b.visitor_id })
          .eq("id", b.session_id).is("visitor_id", null)).error);
      }
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
  };
}
