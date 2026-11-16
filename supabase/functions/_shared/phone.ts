/** Normaliza telefone brasileiro para E.164 ("+55..."), ou null se inválido. */
export function normalizePhoneBR(raw: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  else if (!((d.length === 12 || d.length === 13) && d.startsWith("55"))) return null;
  return "+" + d;
}
