import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "../ErrorBoundary";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KEY = "app-chunk-reload-at";
let root, container, reload, realLocation;

function Boom({ error }) {
  throw error;
}
const chunkError = () => Object.assign(new Error("Loading chunk 635 failed."), { name: "ChunkLoadError" });

async function mount(node) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(node); });
}

beforeEach(() => {
  sessionStorage.clear();
  jest.spyOn(console, "error").mockImplementation(() => {}); // React logs caught render errors
  realLocation = window.location;
  reload = jest.fn();
  delete window.location;
  window.location = { ...realLocation, reload };
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  window.location = realLocation;
  jest.restoreAllMocks();
});

const button = () => [...container.querySelectorAll("button")].find((b) => b.textContent === "Recarregar página");

test("renders children when nothing throws", async () => {
  await mount(<ErrorBoundary><p>ok</p></ErrorBoundary>);
  expect(container.textContent).toBe("ok");
});

test("any render error (e.g. createClient without env) -> on-brand fallback, never blank; button reloads", async () => {
  await mount(<ErrorBoundary><Boom error={new Error("supabaseUrl is required.")} /></ErrorBoundary>);
  expect(container.textContent).toContain("Algo deu errado");
  expect(reload).not.toHaveBeenCalled();
  await act(async () => { button().click(); });
  expect(reload).toHaveBeenCalledTimes(1);
});

test("ChunkLoadError (stale tab after deploy) -> one automatic reload, flag stored", async () => {
  await mount(<ErrorBoundary><Boom error={chunkError()} /></ErrorBoundary>);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(Number(sessionStorage.getItem(KEY))).toBeGreaterThan(0);
  expect(container.textContent).toContain("Algo deu errado");
});

test("CSS chunk failure also counts as a chunk error", async () => {
  await mount(<ErrorBoundary><Boom error={new Error("Loading CSS chunk 479 failed.\n(/static/css/479.css)")} /></ErrorBoundary>);
  expect(reload).toHaveBeenCalledTimes(1);
});

test("ChunkLoadError right after an automatic reload -> no second reload (no loop), fallback shown", async () => {
  sessionStorage.setItem(KEY, String(Date.now() - 2000));
  await mount(<ErrorBoundary><Boom error={chunkError()} /></ErrorBoundary>);
  expect(reload).not.toHaveBeenCalled();
  expect(button()).toBeTruthy();
});
