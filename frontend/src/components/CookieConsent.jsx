import React, { useState, useEffect } from "react";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("lgpd-consent");
    if (!consent) {
      // Small delay to let the page load before showing the banner
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("lgpd-consent", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-xs md:max-w-sm bg-[#0A1A2E]/95 backdrop-blur-md border border-[#5B95CE]/30 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <p className="text-xs text-[#F5F2ED]/80 font-sans leading-relaxed">
        Utilizamos cookies para melhorar a sua experiência. Ao continuar navegando, você concorda com a nossa política de privacidade (LGPD).
      </p>
      <div className="flex justify-start">
        <button
          onClick={handleAccept}
          className="text-xs font-semibold bg-[#D9BB78] text-[#0A1A2E] px-5 py-1.5 rounded-full hover:bg-white transition-colors"
        >
          OK, entendi
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
