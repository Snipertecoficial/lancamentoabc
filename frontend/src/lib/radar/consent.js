export function hasConsent() {
  try {
    const v = localStorage.getItem("lgpd-consent");
    return v === "granted" || v === "true";
  } catch (e) {
    return false;
  }
}

export function onConsentChange(cb) {
  const h = (e) => cb(!!(e && e.detail && e.detail.granted));
  window.addEventListener("radar:consent", h);
  return () => window.removeEventListener("radar:consent", h);
}
