import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { EnvProvider, useEnv } from "../EnvContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, container, api;
function Probe() {
  api = useEnv();
  return <span>{api.env}</span>;
}
async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<EnvProvider><Probe /></EnvProvider>); });
}
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});
beforeEach(() => sessionStorage.clear());

test("defaults to production", async () => {
  await mount();
  expect(container.textContent).toBe("production");
});

test("setEnv switches and persists in sessionStorage", async () => {
  await mount();
  await act(async () => { api.setEnv("staging"); });
  expect(container.textContent).toBe("staging");
  expect(sessionStorage.getItem("radar-painel-env")).toBe("staging");
  await act(async () => { root.unmount(); });
  container.remove();
  await mount();
  expect(container.textContent).toBe("staging");
});

test("ignores unknown values", async () => {
  sessionStorage.setItem("radar-painel-env", "hack");
  await mount();
  expect(container.textContent).toBe("production");
  await act(async () => { api.setEnv("dev"); });
  expect(container.textContent).toBe("production");
});
