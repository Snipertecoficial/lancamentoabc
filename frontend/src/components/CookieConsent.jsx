import React, { useState, useEffect } from "react";
import { updateGoogleConsent } from "@/lib/tracking";
import { track } from "@/lib/radar";

const notifyRadar = (granted) => {
  try {
    window.dispatchEvent(new CustomEvent("radar:consent", { detail: { granted } }));
    track("consent", { granted });
  } catch (e) { /* tracking never blocks the user */ }
};

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("lgpd-consent");
    if (consent === "true") {
      localStorage.setItem("lgpd-consent", "granted");
    }
    if (!consent) {
      // Small delay to let the page load before showing the banner
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("lgpd-consent", "granted");
    updateGoogleConsent(true);
    notifyRadar(true);
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem("lgpd-consent", "denied");
    updateGoogleConsent(false);
    notifyRadar(false);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    // Slim bar on phones: the old card covered the hero's main button (and most visitors never answer it).
    <div id="cookie-consent" className="fixed inset-x-0 bottom-0 z-50 bg-[#0A1A2E]/95 backdrop-blur-md border-t border-[#5B95CE]/30 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-700 md:inset-x-auto md:left-4 md:bottom-4 md:max-w-md md:rounded-2xl md:border md:p-3">
      <p className="flex-1 min-w-0 text-[0.7rem] text-[#F5F2ED]/80 font-sans leading-snug">
        Usamos cookies para medir nossos anúncios. Você pode aceitar ou recusar; veja a{" "}
        <a href="/privacidade" className="underline text-[#D9BB78] hover:text-white">Política de Privacidade</a>.
      </p>
      <div className="flex shrink-0 gap-1.5">
        <button
          onClick={handleAccept}
          className="text-xs font-semibold bg-[#D9BB78] text-[#0A1A2E] px-3.5 min-h-[36px] rounded-full hover:bg-white transition-colors"
        >
          Aceitar
        </button>
        <button
          onClick={handleReject}
          className="text-xs font-semibold border border-[#F0F5FA]/30 text-[#F0F5FA] px-3.5 min-h-[36px] rounded-full hover:border-white transition-colors"
        >
          Recusar
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
