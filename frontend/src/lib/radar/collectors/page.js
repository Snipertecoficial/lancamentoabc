const STEPS = [25, 50, 75, 100];

export function start(track) {
  let fired = {};
  const pageView = () => {
    fired = {};
    try { track("page_view", { path: location.pathname }); } catch (e) { /* ignore */ }
  };
  const onScroll = () => {
    try {
      const h = document.documentElement.scrollHeight;
      if (!h) return;
      const pct = ((window.scrollY + window.innerHeight) / h) * 100;
      for (const s of STEPS) {
        if (pct >= s && !fired[s]) {
          fired[s] = true;
          track("scroll_depth", { pct: s });
        }
      }
    } catch (e) { /* ignore */ }
  };
  const origPush = history.pushState;
  history.pushState = function () {
    const r = origPush.apply(this, arguments);
    pageView();
    return r;
  };
  pageView();
  window.addEventListener("popstate", pageView);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    history.pushState = origPush;
    window.removeEventListener("popstate", pageView);
    window.removeEventListener("scroll", onScroll);
  };
}
