// Client-side rules for the native lead form. normalizePhoneBR mirrors
// supabase/functions/_shared/phone.ts so the client never accepts a phone the server rejects.

export const NAME_MIN = 2;
export const NAME_MAX = 80;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Brazilian phone -> E.164 ("+55..."), or null when invalid. Same rules as the server. */
export function normalizePhoneBR(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  else if (!((d.length === 12 || d.length === 13) && d.startsWith("55"))) return null;
  return "+" + d;
}

/** Mask "(11) 99999-9999" / "(11) 3333-4444". Strips a pasted +55 / trunk 0; keeps at most 11 digits. */
export function formatPhoneBR(raw) {
  let d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

export const ERRORS = {
  nameShort: "Digite seu nome (pelo menos 2 letras).",
  nameLong: `Use até ${NAME_MAX} caracteres no nome.`,
  phone: "Digite um WhatsApp com DDD, por exemplo (11) 99999-9999.",
  email: "Confira o e-mail, por exemplo nome@email.com, ou deixe em branco.",
};

/** Returns { name?, phone?, email? } with a message per invalid field ({} when valid). */
export function validateLead({ name, phone, email }) {
  const errors = {};
  const n = (name || "").trim();
  if (n.length < NAME_MIN) errors.name = ERRORS.nameShort;
  else if (n.length > NAME_MAX) errors.name = ERRORS.nameLong;
  if (!normalizePhoneBR(phone)) errors.phone = ERRORS.phone;
  const e = (email || "").trim();
  if (e && (e.length > 254 || !EMAIL_RE.test(e))) errors.email = ERRORS.email;
  return errors;
}
