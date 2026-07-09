import React, { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, MousePointer2 } from "lucide-react";
import { LEISURE_CATEGORIES, HERO_IMAGES, CONSTRUCTION_PHOTOS } from "@/data/content";

// Curated hero images for the 3D slide: fachada + best leisure spaces + construction highlight
const buildSlides = () => {
  const slides = [
    { url: HERO_IMAGES.facade, title: "Fachada", tag: "Empreendimento" },
  ];
  // Pick 1-2 from each leisure category for variety
  LEISURE_CATEGORIES.forEach((cat) => {
    cat.items.slice(0, 2).forEach((it) => {
      slides.push({ url: it.url, title: it.name, tag: cat.title });
    });
  });
  // Add one construction photo
  slides.push({ url: CONSTRUCTION_PHOTOS[0].url, title: "Obra em andamento", tag: "Acompanhamento" });
  return slides;
};

const SLIDES = buildSlides();

const Slider3D = () => {
  const [index, setIndex] = useState(0);
  const containerRef = useRef(null);
  const wheelLock = useRef(false);
  const touchStart = useRef(null);
  const isInView = useRef(false);

  const total = SLIDES.length;

  const goTo = useCallback((i) => {
    setIndex(((i % total) + total) % total);
  }, [total]);

  const next = useCallback(() => setIndex((i) => (i + 1) % total), [total]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total]);

  // Track when the section is in view so wheel only hijacks then
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { isInView.current = e.isIntersecting; });
      },
      { threshold: 0.55 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Wheel navigation — hijack when this section is centered
  useEffect(() => {
    const onWheel = (e) => {
      if (!isInView.current) return;
      // Only hijack if we can still advance / retreat in the deck
      const going = e.deltaY > 0 ? "next" : "prev";
      // Let the page continue when reaching bounds so user can exit the section
      if (going === "next" && index === total - 1) return;
      if (going === "prev" && index === 0) return;
      if (wheelLock.current) { e.preventDefault(); return; }
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      wheelLock.current = true;
      going === "next" ? next() : prev();
      setTimeout(() => { wheelLock.current = false; }, 650);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [index, total, next, prev]);

  // Touch swipe
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e) => { touchStart.current = e.touches[0].clientX; };
    const onEnd = (e) => {
      if (touchStart.current == null) return;
      const dx = e.changedTouches[0].clientX - touchStart.current;
      if (Math.abs(dx) > 45) dx > 0 ? prev() : next();
      touchStart.current = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [next, prev]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (!isInView.current) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const getCardStyle = (i) => {
    const offset = i - index;
    const abs = Math.abs(offset);
    // Hide cards too far to keep DOM light
    const opacity = abs > 2 ? 0 : abs === 0 ? 1 : 0.55 - abs * 0.15;
    const scale = abs === 0 ? 1 : 0.82 - abs * 0.08;
    const translateX = offset * 42; // % of card width sideways
    const rotateY = offset === 0 ? 0 : offset < 0 ? 22 : -22;
    const translateZ = abs === 0 ? 0 : -180 - abs * 60;
    const zIndex = 100 - abs;
    const filter = abs === 0 ? "none" : `blur(${Math.min(abs * 1.5, 4)}px) saturate(.6)`;
    return {
      opacity,
      zIndex,
      transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      pointerEvents: abs === 0 ? "auto" : "none",
      filter,
    };
  };

  return (
    <section id="galeria3d" className="slider3d-section" ref={containerRef} data-testid="slider3d-section">
      {/* Top Gradient for text legibility */}
      <div className="absolute top-0 left-0 right-0 h-40 md:h-56 bg-gradient-to-b from-[#0A1930]/90 to-transparent z-[5] pointer-events-none" aria-hidden="true" />
      
      {/* Section header (top) */}
      <div className="absolute top-0 left-0 right-0 pt-10 md:pt-20 z-10 pointer-events-none">
        <div className="container-lp text-center">
          <div className="section-eyebrow justify-center" style={{ display: "inline-flex" }}>Galeria imersiva</div>
          <h2 className="section-title mt-3">Um passeio pelo <em>seu Futuro Lar</em></h2>
        </div>
      </div>

      {/* Counter */}
      <div className="slider3d-counter">
        <span className="current">{String(index + 1).padStart(2, "0")}</span>
        <span className="opacity-60"> / {String(total).padStart(2, "0")}</span>
      </div>

      {/* Dots */}
      <div className="slider3d-dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`slider3d-dot ${i === index ? "active" : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Ir para slide ${i + 1}`}
            data-testid={`slider3d-dot-${i}`}
          />
        ))}
      </div>

      {/* Nav arrows (desktop) */}
      <button className="slider3d-nav prev" onClick={prev} aria-label="Anterior" data-testid="slider3d-prev">
        <ChevronLeft size={22} />
      </button>
      <button className="slider3d-nav next" onClick={next} aria-label="Próximo" data-testid="slider3d-next">
        <ChevronRight size={22} />
      </button>

      {/* 3D stage */}
      <div className="slider3d-stage">
        {SLIDES.map((slide, i) => (
          <div key={i} className="slider3d-card" style={getCardStyle(i)} data-testid={`slider3d-card-${i}`}>
            <img
              src={slide.url}
              alt={slide.title}
              loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
              onError={(e) => { e.currentTarget.style.background = "linear-gradient(135deg,#12294A,#061224)"; }}
            />
            <div className="slider3d-caption">
              <p>{slide.tag}</p>
              <h3>{slide.title}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="slider3d-hint">
        <MousePointer2 size={14} /> Role ou arraste para navegar
      </div>
    </section>
  );
};

export default Slider3D;
