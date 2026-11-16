const SESSION_MS = 30 * 60e3;
const YEAR_S = 34128000;

export function uuid() {
  const c = typeof crypto !== "undefined" ? crypto : null;
  if (c && c.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && c.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => (x + 256).toString(16).slice(1)).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getSessionId(now = Date.now()) {
  try {
    const raw = sessionStorage.getItem("rdr_slast");
    const last = raw === null ? NaN : Number(raw);
    let sid = sessionStorage.getItem("rdr_sid");
    if (!sid || isNaN(last) || now - last > SESSION_MS) {
      sid = uuid();
      sessionStorage.setItem("rdr_sid", sid);
    }
    sessionStorage.setItem("rdr_slast", String(now));
    return sid;
  } catch (e) {
    return uuid();
  }
}

function readCookie() {
  const m = document.cookie.match(/(?:^|;\s*)rdr_vid=([^;]+)/);
  return m ? m[1] : null;
}

export function getVisitorId(granted) {
  if (!granted) return null;
  try {
    let v = readCookie();
    if (!v) {
      try { v = localStorage.getItem("rdr_vid"); } catch (e) { /* ignore */ }
    }
    if (!v) v = uuid();
    document.cookie = `rdr_vid=${v}; max-age=${YEAR_S}; path=/; SameSite=Lax`;
    try { localStorage.setItem("rdr_vid", v); } catch (e) { /* ignore */ }
    return v;
  } catch (e) {
    return null;
  }
}
