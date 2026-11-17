import React from "react";

// Radar-scope backdrop for the login and access screens: concentric rings and a sweep that
// turns once on arrival, then rests (skipped when the user prefers reduced motion).
const RINGS = [120, 210, 300, 390, 480];
const SWEEP_CSS =
  "@keyframes painel-sweep{from{transform:rotate(-200deg);opacity:0}30%{opacity:1}to{transform:rotate(-38deg);opacity:1}}" +
  ".painel-sweep{transform:rotate(-38deg)}" +
  "@media (prefers-reduced-motion:no-preference){.painel-sweep{animation:painel-sweep 1.8s cubic-bezier(.2,.7,.2,1) both}}";

export default function Scope() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{SWEEP_CSS}</style>
      <div className="absolute left-1/2 top-1/2 h-[960px] w-[960px] -translate-x-1/2 -translate-y-1/2">
        <div
          className="painel-sweep absolute inset-0 rounded-full"
          style={{ background: "conic-gradient(from 0deg, rgba(125,180,232,0) 0deg, rgba(125,180,232,0.2) 52deg, transparent 52.5deg)" }}
        />
        <svg viewBox="0 0 960 960" className="absolute inset-0 h-full w-full">
          <line x1="0" y1="480" x2="960" y2="480" stroke="#3A70A3" strokeOpacity="0.10" />
          <line x1="480" y1="0" x2="480" y2="960" stroke="#3A70A3" strokeOpacity="0.10" />
          {RINGS.map((r, i) => (
            <circle key={r} cx="480" cy="480" r={r} fill="none" stroke="#5B95CE" strokeOpacity={0.22 - i * 0.035} />
          ))}
        </svg>
      </div>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 45%, #061224 80%)" }} />
    </div>
  );
}
