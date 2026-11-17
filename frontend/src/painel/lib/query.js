// Server-side filters for panel_leads (PostgREST via supabase-js).

const quote = (s) => `"${s.replace(/[\\"]/g, (m) => `\\${m}`)}"`;

// or(...) filter for name / e-mail / phone. The term is LIKE-escaped (% _ \) and sent as a
// double-quoted PostgREST value, so , ( ) and quotes cannot break the filter. "*" is dropped
// because PostgREST treats it as a wildcard in like patterns.
export function buildSearchFilter(term) {
  const t = String(term || "").replace(/\*/g, "").trim();
  if (!t) return null;
  const like = quote(`%${t.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  const parts = [`name.ilike.${like}`, `email.ilike.${like}`];
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 2) parts.push(`phone_e164.ilike.${quote(`%${digits}%`)}`);
  return parts.join(",");
}

export function applyLeadFilters(q, { env, fromIso, toIso, origin, stage, search }) {
  let r = q.eq("env", env).gte("created_at", fromIso).lt("created_at", toIso);
  if (origin) r = r.eq("origin", origin);
  if (stage) r = r.eq("stage", stage);
  const s = buildSearchFilter(search);
  if (s) r = r.or(s);
  return r;
}
