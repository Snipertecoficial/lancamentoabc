export function start(track) {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const since = new Map(); // element -> ms when it became visible
  const report = (el, now) => {
    const t0 = since.get(el);
    if (t0 === undefined) return;
    since.delete(el);
    const seconds = Math.round((now - t0) / 1000);
    if (seconds >= 1) {
      try { track("section_view", { seconds }, { section: el.id }); } catch (e) { /* ignore */ }
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      const now = Date.now();
      entries.forEach((en) => {
        if (en.isIntersecting) { if (!since.has(en.target)) since.set(en.target, now); }
        else report(en.target, now);
      });
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll("section[id]").forEach((el) => io.observe(el));
  const onHide = () => {
    const now = Date.now();
    Array.from(since.keys()).forEach((el) => report(el, now));
  };
  window.addEventListener("pagehide", onHide);
  return () => {
    window.removeEventListener("pagehide", onHide);
    io.disconnect();
  };
}
