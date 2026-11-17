import React, { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useOverlay } from "../useOverlay";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// matchMedia fake: one listener list per query, fire(query, matches) simulates a viewport change.
const mql = {};
function installMatchMedia(initial = false) {
  window.matchMedia = (query) => {
    mql[query] = mql[query] || { matches: initial, listeners: [] };
    const m = mql[query];
    return {
      get matches() { return m.matches; },
      addEventListener: (_, fn) => m.listeners.push(fn),
      removeEventListener: (_, fn) => { m.listeners = m.listeners.filter((l) => l !== fn); },
    };
  };
}
function fire(query, matches) {
  const m = mql[query];
  m.matches = matches;
  m.listeners.slice().forEach((fn) => fn({ matches }));
}

let api;
function Harness({ query }) {
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  const first = useRef(null);
  const trigger = useRef(null);
  api = { setOpen };
  useOverlay({ open, onClose: () => setOpen(false), containerRef: panel, initialFocusRef: first, returnFocusRef: trigger, closeAtQuery: query });
  return (
    <div>
      <button ref={trigger} type="button" data-id="trigger">Abrir</button>
      <button type="button" data-id="outside">Fora</button>
      {open && (
        <div ref={panel} data-id="panel">
          <button ref={first} type="button" data-id="first">Primeiro</button>
          <button type="button" disabled data-id="disabled">Desligado</button>
          <a href="#x" data-id="last">Último</a>
        </div>
      )}
    </div>
  );
}

let root, container;
async function mount(query = "(min-width: 768px)") {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<Harness query={query} />); });
}
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  Object.keys(mql).forEach((k) => delete mql[k]);
  document.body.style.overflow = "";
});
beforeEach(() => installMatchMedia(false));

const el = (id) => container.querySelector(`[data-id="${id}"]`);
const open = async () => { el("trigger").focus(); await act(async () => { api.setOpen(true); }); };
const key = async (k, shiftKey = false) => {
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true, cancelable: true })); });
};

test("open: locks scroll and moves focus inside; close: unlocks and returns focus to the trigger", async () => {
  await mount();
  await open();
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.activeElement).toBe(el("first"));
  await key("Escape");
  expect(el("panel")).toBeNull();
  expect(document.body.style.overflow).toBe("");
  expect(document.activeElement).toBe(el("trigger"));
});

test("Tab and Shift+Tab cycle inside the panel (disabled controls skipped)", async () => {
  await mount();
  await open();
  el("last").focus();
  await key("Tab");
  expect(document.activeElement).toBe(el("first"));
  await key("Tab", true);
  expect(document.activeElement).toBe(el("last"));
});

test("focus that escaped the panel is pulled back in on Tab", async () => {
  await mount();
  await open();
  el("outside").focus();
  await key("Tab");
  expect(document.activeElement).toBe(el("first"));
});

test("closes (and unlocks) when the viewport crosses the breakpoint", async () => {
  await mount("(min-width: 1024px)");
  await open();
  await act(async () => { fire("(min-width: 1024px)", true); });
  expect(el("panel")).toBeNull();
  expect(document.body.style.overflow).toBe("");
});

test("opening while already past the breakpoint closes right away", async () => {
  installMatchMedia(true);
  await mount();
  await open();
  expect(el("panel")).toBeNull();
});

test("works without matchMedia", async () => {
  delete window.matchMedia;
  await mount();
  await open();
  expect(el("panel")).not.toBeNull();
});
