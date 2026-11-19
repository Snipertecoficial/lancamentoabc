import React, { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { setLeadCaptureOpener } from "@/lib/leadCapture";
import { scrollToLeadForm } from "@/lib/whatsapp";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";

// The modal (Radix Dialog + vaul) is its own chunk, so the landing's first paint does not carry it.
// It is prefetched when the browser is idle, or as soon as a pointer goes down on a CTA.
const loadModal = () => import("@/components/LeadCaptureModal");
const LeadCaptureModal = lazy(loadModal);
const PREFETCH_MS = 2500; // fallback when requestIdleCallback is missing (Safari)
const prefetchModal = () => { loadModal().catch(() => {}); };

const LeadCaptureContext = createContext({ open: () => false, isOpen: false });
export const useLeadCapture = () => useContext(LeadCaptureContext);

const isMobileViewport = () => {
  try { return window.matchMedia("(max-width: 767px)").matches; } catch (e) { return false; }
};

// If the modal chunk fails to load or the modal crashes, the visitor still reaches a form.
class ModalBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// Shown only on a first open whose chunk is still downloading.
const ModalLoading = () => (
  <div
    role="status"
    data-testid="lead-capture-loading"
    className="fixed inset-0 z-[10020] flex items-center justify-center bg-[#020A16]/75 backdrop-blur-[3px]"
  >
    <span className="flex items-center gap-2.5 rounded-full border border-[#5B95CE]/30 bg-[#0A1930] px-4 py-2.5 font-sans text-sm text-[#F0F5FA]/90 shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)]">
      <Loader2 size={18} aria-hidden="true" className="animate-spin text-[#7DB4E8] motion-reduce:animate-none" />
      Carregando…
    </span>
  </div>
);

export function LeadCaptureProvider({ children, floating = true }) {
  const [modal, setModal] = useState({ open: false, mounted: false, source: "site", mobile: false });
  const [busy, setBusy] = useState(false); // a lead is in flight: the modal must not close
  const busyRef = useRef(false);
  const failed = useRef(false);
  const opener = useRef(null); // element focused when the modal opened, to return focus on close

  // Returns false when the modal cannot be shown, so callers fall back to the bottom form.
  const open = useCallback(({ source = "site" } = {}) => {
    if (failed.current) return false;
    opener.current = document.activeElement;
    setModal({ open: true, mounted: true, source, mobile: isMobileViewport() });
    return true;
  }, []);
  const onOpenChange = useCallback((next) => {
    if (!next && !busyRef.current) setModal((m) => ({ ...m, open: false }));
  }, []);
  const onBusyChange = useCallback((value) => {
    busyRef.current = value;
    setBusy(value);
  }, []);
  const onFail = useCallback(() => {
    failed.current = true;
    setModal((m) => ({ ...m, open: false, mounted: false }));
    scrollToLeadForm();
  }, []);
  // Back to the CTA that opened the modal.
  const onCloseAutoFocus = useCallback((e) => {
    const el = opener.current;
    opener.current = null;
    if (!el || el === document.body) return;
    e.preventDefault();
    if (el.isConnected) el.focus({ preventScroll: true });
  }, []);

  useEffect(() => setLeadCaptureOpener(open), [open]);
  useEffect(() => {
    const ric = window.requestIdleCallback;
    const idle = typeof ric === "function" ? ric(prefetchModal, { timeout: 4000 }) : null;
    const timer = idle === null ? setTimeout(prefetchModal, PREFETCH_MS) : null;
    const onDown = (ev) => {
      if (!ev.target || !ev.target.closest || !ev.target.closest("button, a")) return;
      document.removeEventListener("pointerdown", onDown, true);
      prefetchModal();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      if (idle !== null && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, []);

  const value = useMemo(() => ({ open, isOpen: modal.open }), [open, modal.open]);

  return (
    <LeadCaptureContext.Provider value={value}>
      {children}
      {modal.mounted && (
        <ModalBoundary onFail={onFail}>
          <Suspense fallback={modal.open ? <ModalLoading /> : null}>
            <LeadCaptureModal
              open={modal.open}
              source={modal.source}
              mobile={modal.mobile}
              busy={busy}
              onBusyChange={onBusyChange}
              onOpenChange={onOpenChange}
              onCloseAutoFocus={onCloseAutoFocus}
            />
          </Suspense>
        </ModalBoundary>
      )}
      {floating && <FloatingWhatsApp hidden={modal.open} />}
    </LeadCaptureContext.Provider>
  );
}

export default LeadCaptureProvider;
