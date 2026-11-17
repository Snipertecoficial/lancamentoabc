// Display helpers for the panel. Dates are always shown in America/Sao_Paulo, pt-BR.
const TZ = "America/Sao_Paulo";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function parts(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = {};
  dateTimeFmt.formatToParts(d).forEach(({ type, value }) => { p[type] = value; });
  return p;
}

export function formatDateTimeBR(iso) {
  const p = parts(iso);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : "";
}

export function formatShortDateTimeBR(iso) {
  const p = parts(iso);
  return p ? `${p.day}/${p.month} ${p.hour}:${p.minute}` : "";
}

export function formatDateBR(iso) {
  const p = parts(iso);
  return p ? `${p.day}/${p.month}/${p.year}` : "";
}

export function formatTimeBR(iso) {
  const p = parts(iso);
  return p ? `${p.hour}:${p.minute}` : "";
}

export function relativeTimeBR(iso, now = new Date()) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.floor((now.getTime() - t) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const days = Math.floor(s / 86400);
  if (days < 30) return days === 1 ? "há 1 dia" : `há ${days} dias`;
  return formatDateBR(iso);
}

// "+5511940383680" -> "(11) 94038-3680"; anything that is not a BR number is returned unchanged.
export function formatPhoneBR(phone) {
  if (!phone) return "";
  let d = String(phone).replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  else if (String(phone).trim().startsWith("+")) return String(phone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(phone);
}

export function waLink(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d ? `https://wa.me/${d}` : null;
}
