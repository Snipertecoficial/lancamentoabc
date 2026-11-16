const WA = /\/\/(?:[\w-]+\.)*(?:wa\.me|whatsapp\.com)(?:[/:]|$)/i;

export function start(track) {
  let recent = []; // {t,x,y}
  const onClick = (ev) => {
    try {
      const now = Date.now();
      const x = ev.clientX || 0;
      const y = ev.clientY || 0;
      const el = ev.target && ev.target.closest && ev.target.closest("a,button,[data-radar]");
      const section = el && el.closest("section[id]");
      const sec = section ? { section: section.id } : undefined;
      let label = "";
      if (el) {
        label = (el.getAttribute("data-radar") || el.getAttribute("data-testid") ||
          (el.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 60);
      }
      recent = recent.filter((r) => now - r.t <= 700);
      recent.push({ t: now, x, y });
      if (recent.length >= 3) {
        const last3 = recent.slice(-3);
        if (last3.every((r) => Math.abs(r.x - x) <= 30 && Math.abs(r.y - y) <= 30)) {
          recent = [];
          track("rage_click", { label, x, y }, sec);
        }
      }
      if (!el) return;
      const props = { label };
      const raw = el.getAttribute("href");
      if (raw) props.href = String(el.href || raw).split("#")[0].split("?")[0];
      track(props.href && WA.test(props.href) ? "whatsapp_click" : "cta_click", props, sec);
    } catch (e) { /* never throw */ }
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
