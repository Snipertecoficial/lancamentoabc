import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import EspontoneLogo from "@/components/EspontoneLogo";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { trackLeadConversion, trackWhatsAppClick } from "@/lib/tracking";
import { track, getLeadToken, confirmLead } from "@/lib/radar";

const ThankYou = () => {
  const waUrl = buildWhatsAppUrl("Olá! Preenchi o formulário no site e gostaria de falar com um corretor sobre o lançamento.");

  useEffect(() => {
    window.scrollTo(0, 0);
    track("thank_you_view");
    // generate_lead only when the server confirms the token's first use (no token = no conversion).
    const token = getLeadToken();
    if (token) {
      confirmLead(token)
        .then((result) => { if (result && result.first_use === true) trackLeadConversion(result.user_data); })
        .catch(() => {});
    }
    // Give GTM up to 5s to dispatch GA4 and Google Ads before leaving the page.
    const timer = setTimeout(() => {
      track("whatsapp_click", { lead_token: token }, { name: "thank_you_auto_redirect" });
      trackWhatsAppClick("thank_you_auto_redirect", {
        onComplete: () => { window.location.href = waUrl; },
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [waUrl]);

  const goToWhatsApp = (e) => {
    // Let modifier/middle clicks open a new tab natively — only intercept a plain click.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    track("whatsapp_click", { lead_token: getLeadToken() }, { name: "thank_you_page" });
    trackWhatsAppClick("thank_you_page", {
      onComplete: () => { window.location.href = waUrl; },
    });
  };

  return (
    <div className="min-h-screen bg-[#0A1930] flex flex-col justify-between">
      {/* Header */}
      <header className="h-20 flex items-center justify-center border-b border-[#F5F2ED]/10">
        <Link to="/">
          <EspontoneLogo />
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#0A1A2E]/50 p-8 rounded-xl border border-[#D9BB78]/20 shadow-2xl backdrop-blur-sm">
          <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-[#25D366]/20 text-[#25D366] mb-6">
            <MessageCircle size={32} />
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-[#F0F5FA] mb-4">
            Quase lá!
          </h1>
          <p className="font-sans text-[#F0F5FA]/75 text-lg leading-relaxed mb-8">
            Você está sendo redirecionado para o WhatsApp de um dos nossos corretores especialistas para receber o material.
          </p>
          <a href={waUrl} onClick={goToWhatsApp} className="btn-gold justify-center w-full py-4 text-base !bg-[#25D366] !text-white hover:!bg-[#20bd5a] !border-none flex items-center gap-2">
            <MessageCircle size={20} />
            Ir para o WhatsApp agora
          </a>
          <div className="mt-4">
            <Link to="/" className="text-[#F0F5FA]/50 text-sm hover:text-[#D9BB78] transition-colors">
              Voltar para a página principal
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#F5F2ED]/10 text-center text-xs text-[#F0F5FA]/50 font-sans tracking-wider uppercase">
        <p>© {new Date().getFullYear()} ESPONTONE LANÇAMENTOS - TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
};

export default ThankYou;
