import { useEffect } from "react";

// Panel pages must never be indexed; the LP's own robots meta is restored on the way out.
export function useNoIndex() {
  useEffect(() => {
    let meta = document.head.querySelector('meta[name="robots"]');
    const previous = meta ? meta.getAttribute("content") : null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
    return () => {
      if (previous === null) meta.remove();
      else meta.setAttribute("content", previous);
    };
  }, []);
}
