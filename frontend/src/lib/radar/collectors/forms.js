const isLeadForm = (f) => !!f && !!f.querySelector('input[name="phone"], input[name="mobile_phone"], input[name="personal_phone"], input[name="email"]');
const formOf = (el) => (el && el.closest ? el.closest("form") : null);

// Behavioural events only: the lead itself is recorded by the server's submit-lead (LeadForm.jsx).
// No typed value is ever read into a tracked event.
export function start(track) {
  const started = new Map(); // form -> last focused field name
  const counted = new WeakSet(); // forms that already emitted form_start
  const safe = (fn) => { try { fn(); } catch (e) { /* never throw */ } };

  const onFocus = (ev) => safe(() => {
    const f = formOf(ev.target);
    if (!isLeadForm(f)) return;
    const field = ev.target.name || "";
    if (!counted.has(f)) {
      counted.add(f);
      track("form_start", { form_id: f.id || undefined });
    }
    started.set(f, field);
  });

  const onChange = (ev) => safe(() => {
    const f = formOf(ev.target);
    if (!isLeadForm(f) || !ev.target.name || !ev.target.value) return;
    track("form_field_complete", { field: ev.target.name });
  });

  const onSubmit = (ev) => safe(() => {
    const f = ev.target;
    if (!isLeadForm(f)) return;
    const formId = f.id || (f.parentElement && f.parentElement.id) || undefined;
    // An attempt may fail validation/network and stay on the page, so it can still be abandoned;
    // on success the form unmounts (SPA navigation) and onHide skips disconnected forms.
    track("form_submit_attempt", { form_id: formId });
  });

  const onHide = () => safe(() => {
    started.forEach((last, f) => {
      if (f.isConnected) track("form_abandon", { last_field: last });
    });
    started.clear();
  });

  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("submit", onSubmit, true);
  window.addEventListener("pagehide", onHide);

  // form_view: #rd-form-section >= 50% visible (the section may be mounted after start).
  let io = null;
  let mo = null;
  let viewed = false;
  const watch = (el) => {
    if (typeof IntersectionObserver === "undefined") return;
    io = new IntersectionObserver((entries) => {
      if (!viewed && entries.some((en) => en.isIntersecting && en.intersectionRatio >= 0.5)) {
        viewed = true;
        safe(() => track("form_view"));
        io.disconnect();
      }
    }, { threshold: [0.5] });
    io.observe(el);
  };
  const section = document.getElementById("rd-form-section");
  if (section) watch(section);
  else if (typeof MutationObserver !== "undefined") {
    mo = new MutationObserver(() => {
      const el = document.getElementById("rd-form-section");
      if (el) { mo.disconnect(); mo = null; watch(el); }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  return () => {
    document.removeEventListener("focusin", onFocus, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("submit", onSubmit, true);
    window.removeEventListener("pagehide", onHide);
    if (io) io.disconnect();
    if (mo) mo.disconnect();
  };
}
