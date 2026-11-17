import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Locks page scroll while a drawer or sheet covers it.
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [locked]);
}

// Modal drawer/sheet behavior while `open`: scroll lock, focus moved in (initialFocusRef) and
// returned on close (returnFocusRef), Tab/Shift+Tab kept inside containerRef, Escape closes, and
// it closes when the viewport reaches `closeAtQuery` (where the overlay no longer exists).
export function useOverlay({ open, onClose, containerRef, initialFocusRef, returnFocusRef, closeAtQuery }) {
  const close = useRef(onClose);
  close.current = onClose;
  useScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const returnTo = returnFocusRef && returnFocusRef.current;
    if (initialFocusRef && initialFocusRef.current) initialFocusRef.current.focus();

    const onKey = (e) => {
      if (e.key === "Escape") { close.current(); return; }
      if (e.key !== "Tab" || !containerRef || !containerRef.current) return;
      const items = [...containerRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = containerRef.current.contains(active);
      if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (returnTo && returnTo.focus) returnTo.focus();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !closeAtQuery || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(closeAtQuery);
    if (mql.matches) { close.current(); return undefined; }
    const onChange = (e) => { if (e.matches) close.current(); };
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else if (mql.addListener) mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  }, [open, closeAtQuery]);
}
