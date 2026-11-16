const STEPS = [25, 50, 75, 100];

export function start(track) {
  const state = new WeakMap(); // video -> {done:{}, unmuted:boolean}
  const get = (v) => {
    let s = state.get(v);
    if (!s) { s = { done: {}, unmuted: false }; state.set(v, s); }
    return s;
  };
  // Media events don't bubble; capture on document also covers videos mounted later.
  const handler = (ev) => {
    try {
      const v = ev.target;
      if (!v || !v.matches || !v.matches("video[data-radar-video]")) return;
      const base = { video: v.getAttribute("data-radar-video") };
      const s = get(v);
      const send = (name, extra) => track("video", Object.assign({}, base, extra), { name });
      if (ev.type === "play") send("play");
      else if (ev.type === "pause") send("pause");
      else if (ev.type === "volumechange") {
        if (!v.muted && !s.unmuted) { s.unmuted = true; send("unmute"); }
        else if (v.muted) s.unmuted = false;
      } else if (ev.type === "timeupdate") {
        if (!(v.duration > 0) || !isFinite(v.duration)) return;
        const pct = (v.currentTime / v.duration) * 100;
        for (const p of STEPS) {
          if (pct >= p && !s.done[p]) { s.done[p] = true; send("progress", { pct: p }); }
        }
      }
    } catch (e) { /* never throw */ }
  };
  const types = ["play", "pause", "volumechange", "timeupdate"];
  types.forEach((t) => document.addEventListener(t, handler, true));
  return () => types.forEach((t) => document.removeEventListener(t, handler, true));
}
