import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { usePanelTitle, useViewportFitCover, PANEL_TITLE } from "../head";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Page() {
  usePanelTitle();
  useViewportFitCover();
  return null;
}

let root, container;
async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<Page />); });
}
async function unmount() {
  await act(async () => { root.unmount(); });
  container.remove();
}
const viewport = () => document.head.querySelector('meta[name="viewport"]');
afterEach(() => { if (viewport()) viewport().remove(); });

test("title is 'Radar — Painel' while mounted and the LP title comes back after", async () => {
  document.title = "Apartamentos à venda no ABC";
  await mount();
  expect(document.title).toBe(PANEL_TITLE);
  expect(PANEL_TITLE).toBe("Radar — Painel");
  await unmount();
  expect(document.title).toBe("Apartamentos à venda no ABC");
});

test("viewport gets viewport-fit=cover while mounted, restored after", async () => {
  const m = document.createElement("meta");
  m.setAttribute("name", "viewport");
  m.setAttribute("content", "width=device-width, initial-scale=1");
  document.head.appendChild(m);
  await mount();
  expect(viewport().getAttribute("content")).toBe("width=device-width, initial-scale=1, viewport-fit=cover");
  await unmount();
  expect(viewport().getAttribute("content")).toBe("width=device-width, initial-scale=1");
});

test("no viewport meta: nothing breaks", async () => {
  await mount();
  expect(viewport()).toBeNull();
  await unmount();
});
