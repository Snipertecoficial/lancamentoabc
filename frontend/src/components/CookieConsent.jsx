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
    <div className="fixed bottom-4 left-4 z-50 max-w-xs md:max-w-sm bg-[#0A1A2E]/95 backdrop-blur-md border border-[#5B95CE]/30 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <p className="text-xs text-[#F5F2ED]/80 font-sans leading-relaxed">
        Utilizamos cookies para melhorar a sua experiência. Ao continuar navegando, você concorda com a nossa política de privacidade (LGPD).
      </p>
      <div className="flex flex-wrap justify-start gap-2">
        <button
          onClick={handleAccept}
          className="text-xs font-semibold bg-[#D9BB78] text-[#0A1A2E] px-5 py-1.5 rounded-full hover:bg-white transition-colors"
        >
          Aceitar
        </button>
        <button
          onClick={handleReject}
          className="text-xs font-semibold border border-[#F0F5FA]/30 text-[#F0F5FA] px-5 py-1.5 rounded-full hover:border-white transition-colors"
        >
          Recusar
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
