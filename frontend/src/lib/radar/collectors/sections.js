export function start(track) {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const since = new Map(); // element -> ms when the current visible stretch began (running clock)
  const inview = new Set(); // elements currently in view (clock may be paused while tab hidden)
  const report = (el, now) => {
    const t0 = since.get(el);
    if (t0 === undefined) return;
    since.delete(el);
    const seconds = Math.round((now - t0) / 1000);
    if (seconds >= 1) {
      try { track("section_view", { seconds }, { section: el.id }); } catch (e) { /* ignore */ }
    }
  };
  // In view = >=50% of the section visible OR the visible part covers >=50% of the viewport
  // (tall sections, e.g. mobile hero, can never reach a 0.5 ratio).
  const inView = (en) => {
    if (!en.isIntersecting) return false;
    if (en.intersectionRatio >= 0.5) return true;
    const vh = (en.rootBounds && en.rootBounds.height) || window.innerHeight;
    return !!en.intersectionRect && en.intersectionRect.height >= 0.5 * vh;
  };
  const io = new IntersectionObserver(
    (entries) => {
      const now = Date.now();
      entries.forEach((en) => {
        if (inView(en)) {
          inview.add(en.target);
          if (!since.has(en.target) && document.visibilityState !== "hidden") since.set(en.target, now);
        } else {
          inview.delete(en.target);
          report(en.target, now);
        }
      });
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  );
  // Most sections are lazy (React.lazy) and mount after start: watch for them too.
  const watched = new WeakSet();
  const scan = () => document.querySelectorAll("section[id]").forEach((el) => {
    if (!watched.has(el)) { watched.add(el); io.observe(el); }
  });
  scan();
  const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(scan) : null;
  if (mo) mo.observe(document.body, { childList: true, subtree: true });
  // Hidden tab / pagehide: close every running clock (emit section_view) so hidden time is not counted.
  const onHide = () => {
    const now = Date.now();
    Array.from(since.keys()).forEach((el) => report(el, now));
  };
  const onVis = () => {
    if (document.visibilityState === "hidden") onHide();
    else { const now = Date.now(); inview.forEach((el) => since.set(el, now)); }
  };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onVis);
    if (mo) mo.disconnect();
    io.disconnect();
  };
}
