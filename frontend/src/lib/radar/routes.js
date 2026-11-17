// The admin panel (/login, /painel/*) lives in the same app but is never tracked and never runs
// landing-page widgets. The single source for this check (public/index.html keeps an inline copy
// for the GTM loader, which runs before any bundle).
export const PANEL_ROUTE_RE = /^\/(login|painel)(\/|$)/i;

export function onPanelRoute() {
  try { return PANEL_ROUTE_RE.test(window.location.pathname); } catch (e) { return false; }
}
