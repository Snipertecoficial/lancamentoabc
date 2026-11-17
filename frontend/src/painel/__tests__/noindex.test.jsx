import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useNoIndex } from "../noindex";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Page() {
  useNoIndex();
  return null;
}
const robots = () => document.head.querySelectorAll('meta[name="robots"]');

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
afterEach(() => { robots().forEach((m) => m.remove()); });

test("existing index robots meta becomes noindex while mounted, restored after", async () => {
  const m = document.createElement("meta");
  m.setAttribute("name", "robots");
  m.setAttribute("content", "index, follow");
  document.head.appendChild(m);
  await mount();
  expect(robots()).toHaveLength(1);
  expect(robots()[0].getAttribute("content")).toBe("noindex, nofollow");
  await unmount();
  expect(robots()[0].getAttribute("content")).toBe("index, follow");
});

test("without a robots meta: adds one, removes it on unmount", async () => {
  await mount();
  expect(robots()[0].getAttribute("content")).toBe("noindex, nofollow");
  await unmount();
  expect(robots()).toHaveLength(0);
});
