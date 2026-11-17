// Bridge between plain helpers (openWhatsApp) and the mounted LeadCaptureProvider.
// Without a mounted provider, openLeadCapture returns false and the caller falls back.
let opener = null;

export function setLeadCaptureOpener(fn) {
  opener = fn;
  return () => { if (opener === fn) opener = null; };
}

export function openLeadCapture(options) {
  if (!opener) return false;
  try { return opener(options) !== false; } catch (e) { return false; }
}

// submit-lead accepts form_id matching ^[A-Za-z0-9_-]{1,64}$.
export function modalFormId(source) {
  const clean = String(source || "site").replace(/[^A-Za-z0-9_-]/g, "_");
  return `modal-${clean}`.slice(0, 64);
}
