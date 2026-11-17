import React, { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { setLeadCaptureOpener } from "@/lib/leadCapture";
import { scrollToLeadForm } from "@/lib/whatsapp";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";

// The modal (Radix Dialog + vaul) is its own chunk, so the landing's first paint does not carry it;
// it is prefetched shortly after load so the first click opens without a visible wait.
const loadModal = () => import("@/components/LeadCaptureModal");
const LeadCaptureModal = lazy(loadModal);
const PREFETCH_MS = 2500;

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

export function LeadCaptureProvider({ children, floating = true }) {
  const [modal, setModal] = useState({ open: false, mounted: false, source: "site", mobile: false });
  const failed = useRef(false);

  // Returns false when the modal cannot be shown, so callers fall back to the bottom form.
  const open = useCallback(({ source = "site" } = {}) => {
    if (failed.current) return false;
    setModal({ open: true, mounted: true, source, mobile: isMobileViewport() });
    return true;
  }, []);
  const onOpenChange = useCallback((next) => {
    if (!next) setModal((m) => ({ ...m, open: false }));
  }, []);
  const onFail = useCallback(() => {
    failed.current = true;
    setModal((m) => ({ ...m, open: false, mounted: false }));
    scrollToLeadForm();
  }, []);

  useEffect(() => setLeadCaptureOpener(open), [open]);
  useEffect(() => {
    const t = setTimeout(() => { loadModal().catch(() => {}); }, PREFETCH_MS);
    return () => clearTimeout(t);
  }, []);

  const value = useMemo(() => ({ open, isOpen: modal.open }), [open, modal.open]);

  return (
    <LeadCaptureContext.Provider value={value}>
      {children}
      {modal.mounted && (
        <ModalBoundary onFail={onFail}>
          <Suspense fallback={null}>
            <LeadCaptureModal open={modal.open} source={modal.source} mobile={modal.mobile} onOpenChange={onOpenChange} />
          </Suspense>
        </ModalBoundary>
      )}
      {floating && <FloatingWhatsApp hidden={modal.open} />}
    </LeadCaptureContext.Provider>
  );
}

export default LeadCaptureProvider;
