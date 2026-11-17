import { start } from "../collectors/forms";

// The page's lead form is the native LeadForm.jsx (RD Station removed). The server's submit-lead
// records the lead itself, so the collector only emits behavioural events and never identifies.
const NATIVE = `
<section id="rd-form-section"><div id="form-lead">
  <form id="conversion-form-espontone" data-radar-native method="post">
    <input name="name" /><input name="phone" type="tel" /><input name="email" />
    <button type="submit">Receber as tabelas</button>
  </form></div></section>`;
const fill = (sel, v) => { const i = document.querySelector(sel); i.value = v; return i; };
const focus = (el) => el.dispatchEvent(new Event("focusin", { bubbles: true }));
const change = (el) => el.dispatchEvent(new Event("change", { bubbles: true }));
const submit = (form) => {
  const ev = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
  return ev;
};
const form = () => document.getElementById("conversion-form-espontone");

let track, stop, observers;
beforeEach(() => {
  document.body.innerHTML = NATIVE;
  track = jest.fn();
  observers = [];
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe(el) { this.el = el; }
    disconnect() {}
  };
  stop = start(track);
});
afterEach(() => { stop(); delete global.IntersectionObserver; });

test("submit -> form_submit_attempt only; never prevented; start takes no identify callback", () => {
  expect(start.length).toBe(1);
  fill('[name="name"]', "Ana");
  fill('[name="phone"]', "(11) 94038-3680");
  const ev = submit(form());
  expect(ev.defaultPrevented).toBe(false);
  expect(track.mock.calls).toEqual([["form_submit_attempt", { form_id: "conversion-form-espontone" }]]);
});

test("typed values never appear in tracked events", () => {
  const i = fill('[name="email"]', "secret@x.com");
  const p = fill('[name="phone"]', "(11) 99999-1234");
  focus(i);
  change(i);
  focus(p);
  change(p);
  submit(form());
  window.dispatchEvent(new Event("pagehide"));
  const all = JSON.stringify(track.mock.calls);
  expect(all).not.toContain("secret@x.com");
  expect(all).not.toContain("99999");
});

test("form_start once per form; form_field_complete only {field}", () => {
  const p = document.querySelector('[name="phone"]');
  focus(p);
  focus(document.querySelector('[name="name"]'));
  expect(track.mock.calls.filter((c) => c[0] === "form_start")).toEqual([["form_start", { form_id: "conversion-form-espontone" }]]);
  p.value = "(11) 99999-9999";
  change(p);
  expect(track).toHaveBeenCalledWith("form_field_complete", { field: "phone" });
  change(document.querySelector('[name="name"]')); // empty
  expect(track.mock.calls.filter((c) => c[0] === "form_field_complete")).toHaveLength(1);
});

test("a phone-only form is recognized as a lead form", () => {
  document.body.insertAdjacentHTML("beforeend", '<form id="p4"><input name="phone" /></form>');
  focus(document.querySelector("#p4 [name=phone]"));
  expect(track).toHaveBeenCalledWith("form_start", { form_id: "p4" });
});

test("a form injected after start is captured", () => {
  const d = document.createElement("div");
  d.innerHTML = '<form id="popup"><input name="phone" /></form>';
  document.body.appendChild(d);
  submit(d.querySelector("form"));
  expect(track).toHaveBeenCalledWith("form_submit_attempt", { form_id: "popup" });
});

test("non-lead form is ignored", () => {
  document.body.insertAdjacentHTML("beforeend", '<form id="search"><input name="q" /></form>');
  const f = document.getElementById("search");
  focus(f.querySelector("input"));
  submit(f);
  expect(track).not.toHaveBeenCalled();
});

test("focus + pagehide without submit -> form_abandon {last_field}", () => {
  focus(document.querySelector('[name="phone"]'));
  window.dispatchEvent(new Event("pagehide"));
  expect(track).toHaveBeenCalledWith("form_abandon", { last_field: "phone" });
});

test("no abandon without focus", () => {
  window.dispatchEvent(new Event("pagehide"));
  expect(track).not.toHaveBeenCalledWith("form_abandon", expect.anything());
});

test("a failed attempt (form still on page) can still be abandoned; an unmounted form is not", () => {
  focus(document.querySelector('[name="name"]'));
  submit(form());
  window.dispatchEvent(new Event("pagehide"));
  expect(track).toHaveBeenCalledWith("form_abandon", { last_field: "name" });
  track.mockClear();
  focus(document.querySelector('[name="phone"]'));
  submit(form());
  form().remove(); // success: SPA navigates to /obrigado and the form unmounts
  window.dispatchEvent(new Event("pagehide"));
  expect(track).not.toHaveBeenCalledWith("form_abandon", expect.anything());
});

test("form_view once when #rd-form-section reaches 50% visible", () => {
  const io = observers[0];
  expect(io.el.id).toBe("rd-form-section");
  io.cb([{ isIntersecting: true, intersectionRatio: 0.6, target: io.el }]);
  io.cb([{ isIntersecting: true, intersectionRatio: 0.9, target: io.el }]);
  expect(track.mock.calls.filter((c) => c[0] === "form_view")).toHaveLength(1);
});
