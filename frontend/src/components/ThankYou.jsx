import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import EspontoneLogo from "@/components/EspontoneLogo";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { trackLeadConversion, trackWhatsAppClick } from "@/lib/tracking";
import { track, getLeadToken, confirmLead, isRadarEnabled } from "@/lib/radar";

const CONFIRM_RETRIES = 2; // extra attempts when confirm-lead answers null (transient network/server failure)
const RETRY_DELAY_MS = 700;
const CLICK_MAX_WAIT_MS = 1500; // total budget on click: pending confirmation + GTM wait
const GTM_WAIT_MS = 1000;

const ThankYou = () => {
  const waUrl = buildWhatsAppUrl("Olá! Preenchi o formulário no site e gostaria de falar com um corretor sobre o lançamento.");

  const pending = useRef(Promise.resolve());

  useEffect(() => {
    window.scrollTo(0, 0);
    track("thank_you_view");
    let cancelled = false;
    const token = getLeadToken();
    if (!isRadarEnabled()) {
      // Radar disabled (no REACT_APP_RADAR_URL): keep the legacy behaviour so no conversion is lost.
      trackLeadConversion();
    } else if (token) {
      // generate_lead only when the server confirms the token's first use (no token = no conversion).
      pending.current = (async () => {
        for (let i = 0; i <= CONFIRM_RETRIES && !cancelled; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          if (cancelled) return;
          const result = await confirmLead(token);
          if (result) {
            if (result.first_use === true) trackLeadConversion(result.user_data);
            return;
          }
        }
      })().catch(() => {});
    }
    // Give GTM up to 5s to dispatch GA4 and Google Ads before leaving the page.
    const timer = setTimeout(() => {
      track("whatsapp_click", { lead_token: token }, { name: "thank_you_auto_redirect" });
      trackWhatsAppClick("thank_you_auto_redirect", {
        onComplete: () => { window.location.href = waUrl; },
      });
    }, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [waUrl]);

  const goToWhatsApp = (e) => {
    // Let modifier/middle clicks open a new tab natively — only intercept a plain click.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    track("whatsapp_click", { lead_token: getLeadToken() }, { name: "thank_you_page" });
    // Navigate once GTM confirmed AND the pending confirmation (incl. retries) settled, but never
    // later than CLICK_MAX_WAIT_MS in total, so a conversion is not lost on a quick click.
    let gtmDone = false;
    let confirmDone = false;
    let went = false;
    const go = () => { if (!went) { went = true; window.location.href = waUrl; } };
    const check = () => { if (gtmDone && confirmDone) go(); };
    pending.current.then(() => { confirmDone = true; check(); });
    setTimeout(go, CLICK_MAX_WAIT_MS);
    trackWhatsAppClick("thank_you_page", {
      timeout: GTM_WAIT_MS,
      onComplete: () => { gtmDone = true; check(); },
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
          <a href={waUrl} data-radar-skip onClick={goToWhatsApp} className="btn-gold justify-center w-full py-4 text-base !bg-[#25D366] !text-white hover:!bg-[#20bd5a] !border-none flex items-center gap-2">
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
