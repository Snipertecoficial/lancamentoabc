import React, { useEffect, useState } from "react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";

const HIDDEN_ROUTES = /^\/(login|painel|obrigado)(\/|$)/i;
const MOBILE_MAX = 767;
const GAP = 12; // space between the cookie banner and the button

// Fixed "Falar com corretor" button: opens the capture modal (via openWhatsApp, which keeps the GTM
// whatsapp_click signal). Hidden while the modal is open and while the bottom form is on screen (so
// it never covers its submit button); on phones it rises above the cookie banner while that is shown.
const FloatingWhatsApp = ({ hidden = false }) => {
  const [formInView, setFormInView] = useState(false);
  const [lift, setLift] = useState(0); // px to clear the cookie banner (0 = no banner / no overlap)

  useEffect(() => {
    let section = null;
    let io = null;
    let banner = null;
    let ro = null;

    const measure = () => {
      if (!banner || window.innerWidth > MOBILE_MAX) { setLift(0); return; }
      // The banner's own CSS bottom, not its rect: its entrance animation translates it.
      const offset = parseFloat(window.getComputedStyle(banner).bottom) || 0;
      setLift(Math.round(banner.getBoundingClientRect().height + offset + GAP));
    };

    const sync = () => {
      const s = document.getElementById("rd-form-section");
      if (s !== section) {
        if (io) { io.disconnect(); io = null; }
        section = s;
        setFormInView(false);
        if (s && typeof IntersectionObserver !== "undefined") {
          io = new IntersectionObserver((entries) => setFormInView(entries.some((en) => en.isIntersecting)));
          io.observe(s);
        }
      }
      const b = document.getElementById("cookie-consent");
      if (b !== banner) {
        if (ro) { ro.disconnect(); ro = null; }
        banner = b;
        if (b && typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(measure);
          ro.observe(b);
        }
        measure();
      }
    };

    sync();
    // The bottom form and the cookie banner are lazy: watch for them to mount / unmount.
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(sync) : null;
    if (mo) mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => {
      if (mo) mo.disconnect();
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (hidden || formInView || HIDDEN_ROUTES.test(window.location.pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => openWhatsApp(WA_MESSAGES.general, "floating_whatsapp")}
      aria-label="Falar com corretor pelo WhatsApp"
      data-testid="floating-whatsapp"
      data-lift={lift}
      style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${16 + lift}px)` }}
      className="btn-whatsapp fixed right-4 z-[9980] min-h-[48px] !px-5 !py-0 text-[0.95rem] shadow-[0_14px_32px_-12px_rgba(0,0,0,.6)] animate-in fade-in-0 slide-in-from-bottom-3 duration-500 motion-reduce:animate-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1930] md:right-6 md:h-14 md:w-14 md:!p-0"
    >
      <WhatsAppIcon size={22} />
      <span className="md:sr-only">Falar com corretor</span>
    </button>
  );
};

export default FloatingWhatsApp;
