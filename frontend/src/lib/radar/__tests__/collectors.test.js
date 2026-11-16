import { start as startPage } from "../collectors/page";
import { start as startSections } from "../collectors/sections";
import { start as startClicks } from "../collectors/clicks";
import { start as startVideo } from "../collectors/video";

let track, stops;
beforeEach(() => {
  track = jest.fn();
  stops = [];
  document.body.innerHTML = "";
});
afterEach(() => { stops.forEach((s) => s()); jest.restoreAllMocks(); });
const run = (fn) => { const s = fn(track); stops.push(s); return s; };

test("click on button inside section -> cta_click with label and section", () => {
  document.body.innerHTML = '<section id="top"><button data-testid="hero-cta-visit">Agendar visita</button></section>';
  run(startClicks);
  document.querySelector("button").click();
  expect(track).toHaveBeenCalledWith("cta_click", { label: "hero-cta-visit" }, { section: "top" });
});

test("wa.me link -> whatsapp_click, href without query/fragment", () => {
  document.body.innerHTML = '<section id="contato"><a href="https://wa.me/5511999999999?text=oi#x">Falar</a></section>';
  run(startClicks);
  document.querySelector("a").click();
  expect(track).toHaveBeenCalledWith(
    "whatsapp_click",
    { label: "Falar", href: "https://wa.me/5511999999999" },
    { section: "contato" }
  );
});

test("element with or inside [data-radar-skip] is not tracked", () => {
  document.body.innerHTML = '<section id="s"><a data-radar-skip href="https://wa.me/5511999999999">Falar</a><div data-radar-skip><button>x</button></div></section>';
  run(startClicks);
  document.querySelector("a").click();
  document.querySelector("button").click();
  expect(track).not.toHaveBeenCalled();
});

test("label falls back to text capped at 60 chars", () => {
  document.body.innerHTML = `<button>${"x".repeat(100)}</button>`;
  run(startClicks);
  document.querySelector("button").click();
  expect(track.mock.calls[0][1].label).toHaveLength(60);
});

test("3 fast clicks nearby -> a single rage_click", () => {
  document.body.innerHTML = '<section id="top"><button>ok</button></section>';
  run(startClicks);
  const b = document.querySelector("button");
  for (let i = 0; i < 3; i++) b.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
  expect(track.mock.calls.filter((c) => c[0] === "rage_click")).toHaveLength(1);
});

test("scroll to 60% -> scroll_depth 25 and 50 once each", () => {
  jest.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(1000);
  window.innerHeight = 400;
  run(startPage);
  window.scrollY = 200; // (200+400)/1000 = 60%
  window.dispatchEvent(new Event("scroll"));
  window.dispatchEvent(new Event("scroll"));
  const d = track.mock.calls.filter((c) => c[0] === "scroll_depth").map((c) => c[1].pct);
  expect(d).toEqual([25, 50]);
  window.scrollY = 0;
});

test("page_view on start and on pushState", () => {
  run(startPage);
  expect(track).toHaveBeenCalledWith("page_view", expect.any(Object));
  history.pushState({}, "", "/x");
  expect(track.mock.calls.filter((c) => c[0] === "page_view")).toHaveLength(2);
});

test("video: timeupdate at 52% -> progress 25 and 50; volumechange unmuted -> unmute", () => {
  document.body.innerHTML = '<video data-radar-video="hero"></video>';
  const v = document.querySelector("video");
  Object.defineProperty(v, "duration", { value: 100, configurable: true });
  v.currentTime = 52;
  run(startVideo);
  v.dispatchEvent(new Event("timeupdate"));
  v.dispatchEvent(new Event("timeupdate"));
  const prog = track.mock.calls.filter((c) => c[2] && c[2].name === "progress").map((c) => c[1].pct);
  expect(prog).toEqual([25, 50]);
  v.muted = false;
  v.dispatchEvent(new Event("volumechange"));
  expect(track).toHaveBeenCalledWith("video", { video: "hero" }, { name: "unmute" });
});

describe("sections", () => {
  test("no IntersectionObserver -> no-op", () => {
    delete global.IntersectionObserver;
    expect(() => run(startSections)).not.toThrow();
  });

  test("section_view with seconds when leaving after >=1s", () => {
    let cb;
    global.IntersectionObserver = jest.fn((f) => { cb = f; return { observe: jest.fn(), disconnect: jest.fn() }; });
    document.body.innerHTML = '<section id="faq"></section>';
    const el = document.querySelector("section");
    let now = 1000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    run(startSections);
    cb([{ target: el, isIntersecting: true, intersectionRatio: 0.6 }]);
    now = 4400;
    cb([{ target: el, isIntersecting: false, intersectionRatio: 0 }]);
    expect(track).toHaveBeenCalledWith("section_view", { seconds: 3 }, { section: "faq" });
    delete global.IntersectionObserver;
  });

  test("tall section covering 60% of viewport at 0.3 ratio counts as in view", () => {
    let cb;
    global.IntersectionObserver = jest.fn((f) => { cb = f; return { observe: jest.fn(), disconnect: jest.fn() }; });
    document.body.innerHTML = '<section id="top"></section>';
    const el = document.querySelector("section");
    let now = 1000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    run(startSections);
    expect(global.IntersectionObserver.mock.calls[0][1].threshold).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const tall = { target: el, isIntersecting: true, intersectionRatio: 0.3,
      rootBounds: { height: 800 }, intersectionRect: { height: 480 } };
    cb([tall]);
    now = 3000;
    cb([{ target: el, isIntersecting: false, intersectionRatio: 0 }]);
    expect(track).toHaveBeenCalledWith("section_view", { seconds: 2 }, { section: "top" });
    // 30% ratio and only 40% of viewport -> not in view
    track.mockClear();
    cb([{ ...tall, intersectionRect: { height: 320 } }]);
    now = 9000;
    cb([{ target: el, isIntersecting: false, intersectionRatio: 0 }]);
    expect(track).not.toHaveBeenCalled();
    delete global.IntersectionObserver;
  });
});
