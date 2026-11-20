import React, { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/radar", () => ({ track: jest.fn(), chatCode: () => "A1B2C3" }));

const HeroSection = require("../HeroSection").default;

let root, container, play, observers;
const $ = (sel) => document.querySelector(sel);

class FakeObserver {
  constructor(cb, opts) {
    this.cb = cb;
    this.opts = opts;
    this.targets = [];
    this.disconnected = false;
    observers.push(this);
  }
  observe(el) { this.targets.push(el); }
  disconnect() { this.disconnected = true; }
}

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<HeroSection />); });
}

beforeEach(() => {
  observers = [];
  window.IntersectionObserver = FakeObserver;
  play = jest.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  if (container) container.remove();
  root = null;
  container = null;
  delete window.IntersectionObserver;
  play.mockRestore();
});

test("says what the ads promise: na planta, on the Santo André / São Bernardo border", async () => {
  await mount();
  const top = $('[data-testid="hero-section"]').textContent;
  expect(top).toMatch(/Divisa Santo André \/ São Bernardo/);
  expect($("h1").textContent).toBe("Apartamentos na planta a 2 minutos do Shopping Metrópole");
  expect(top).toMatch(/2 ou 3 dorms com suíte/);
  expect(top).not.toMatch(/— SBC/);
});

test("the video does not download when the page opens; it starts once it shows up on screen", async () => {
  await mount();
  const video = $('[data-testid="hero-video"]');
  expect(video.getAttribute("preload")).toBe("none");
  expect(video.autoplay).toBe(false);
  expect(video.querySelector("source").getAttribute("src")).toBe("/tour-video-720.mp4");
  expect(play).not.toHaveBeenCalled();

  const io = observers.find((o) => o.targets.includes(video));
  expect(io).toBeDefined();
  await act(async () => { io.cb([{ isIntersecting: false, target: video }]); });
  expect(play).not.toHaveBeenCalled();
  await act(async () => { io.cb([{ isIntersecting: true, target: video }]); });
  expect(play).toHaveBeenCalledTimes(1);
  expect(io.disconnected).toBe(true);
});

test("without IntersectionObserver nothing plays by itself; the play button offers to start it", async () => {
  delete window.IntersectionObserver;
  await mount();
  expect(play).not.toHaveBeenCalled();
  expect($('[data-testid="hero-video-play-toggle"]').getAttribute("aria-label")).toBe("Tocar vídeo");
});
