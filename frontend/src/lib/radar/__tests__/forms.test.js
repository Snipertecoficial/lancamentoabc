import { start } from "../collectors/forms";

const RD = `
<section id="rd-form-section"><div id="espontone-16aa058dd608303c1ceb">
  <form id="conversion-form">
    <input name="name" /><input name="email" /><input name="mobile_phone" />
    <button type="submit">Enviar</button>
  </form></div></section>`;
const fill = (sel, v) => { const i = document.querySelector(sel); i.value = v; return i; };
const focus = (el) => el.dispatchEvent(new Event("focusin", { bubbles: true }));
const submit = (form) => {
  const ev = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
  return ev;
};

let track, identify, stop, observers;
beforeEach(() => {
  document.body.innerHTML = RD;
  track = jest.fn();
  identify = jest.fn();
  observers = [];
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe(el) { this.el = el; }
    disconnect() {}
  };
  stop = start(track, identify);
});
afterEach(() => { stop(); delete global.IntersectionObserver; });

test("submit -> form_submit_attempt + identifyLead, never prevented", () => {
  fill('[name="name"]', "Ana");
  fill('[name="email"]', "a@x.com");
  fill('[name="mobile_phone"]', "(11) 94038-3680");
  const ev = submit(document.querySelector("form"));
  expect(ev.defaultPrevented).toBe(false);
  expect(identify).toHaveBeenCalledWith({
    name: "Ana", phone: "(11) 94038-3680", email: "a@x.com", formId: "conversion-form",
  });
  expect(track).toHaveBeenCalledWith("form_submit_attempt", { form_id: "conversion-form" });
});

test("typed values never appear in tracked events", () => {
  const i = fill('[name="email"]', "secret@x.com");
  focus(i);
  i.dispatchEvent(new Event("change", { bubbles: true }));
  submit(document.querySelector("form"));
  window.dispatchEvent(new Event("pagehide"));
  expect(JSON.stringify(track.mock.calls)).not.toContain("secret@x.com");
});

test("a throwing identifyLead does not break submit", () => {
  identify.mockImplementation(() => { throw new Error("x"); });
  expect(() => submit(document.querySelector("form"))).not.toThrow();
});

test("form injected after start (pop-up) is captured", () => {
  const d = document.createElement("div");
  d.innerHTML = '<form id="popup"><input name="email" value="p@x.com" /></form>';
  document.body.appendChild(d);
  submit(d.querySelector("form"));
  expect(identify).toHaveBeenCalledWith({ name: "", phone: "", email: "p@x.com", formId: "popup" });
});

test("non-lead form is ignored", () => {
  document.body.insertAdjacentHTML("beforeend", '<form id="search"><input name="q" /></form>');
  const f = document.getElementById("search");
  focus(f.querySelector("input"));
  submit(f);
  expect(identify).not.toHaveBeenCalled();
  expect(track).not.toHaveBeenCalled();
});

test("form_start once per form; form_field_complete only {field}", () => {
  const e = document.querySelector('[name="email"]');
  focus(e);
  focus(document.querySelector('[name="name"]'));
  expect(track.mock.calls.filter((c) => c[0] === "form_start")).toHaveLength(1);
  e.value = "a@x.com";
  e.dispatchEvent(new Event("change", { bubbles: true }));
  expect(track).toHaveBeenCalledWith("form_field_complete", { field: "email" });
  document.querySelector('[name="name"]').dispatchEvent(new Event("change", { bubbles: true })); // empty
  expect(track.mock.calls.filter((c) => c[0] === "form_field_complete")).toHaveLength(1);
});

test("focus + pagehide without submit -> form_abandon {last_field}", () => {
  focus(document.querySelector('[name="email"]'));
  window.dispatchEvent(new Event("pagehide"));
  expect(track).toHaveBeenCalledWith("form_abandon", { last_field: "email" });
});

test("no abandon without focus, nor after submit", () => {
  window.dispatchEvent(new Event("pagehide"));
  expect(track).not.toHaveBeenCalledWith("form_abandon", expect.anything());
  focus(document.querySelector('[name="email"]'));
  submit(document.querySelector("form"));
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
