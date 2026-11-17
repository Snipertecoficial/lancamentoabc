import { useEffect } from "react";

export const PANEL_TITLE = "Radar — Painel";

// Panel tab title (the LP's own title comes back on the way out).
export function usePanelTitle() {
  useEffect(() => {
    const previous = document.title;
    document.title = PANEL_TITLE;
    return () => { document.title = previous; };
  }, []);
}

// Lets the panel draw edge to edge on notched phones; its shell pads with env(safe-area-inset-*).
// The LP's viewport meta is restored on the way out.
export function useViewportFitCover() {
  useEffect(() => {
    const meta = document.head.querySelector('meta[name="viewport"]');
    if (!meta) return undefined;
    const previous = meta.getAttribute("content") || "";
    if (!/viewport-fit/.test(previous)) meta.setAttribute("content", `${previous ? `${previous}, ` : ""}viewport-fit=cover`);
    return () => { meta.setAttribute("content", previous); };
  }, []);
}
