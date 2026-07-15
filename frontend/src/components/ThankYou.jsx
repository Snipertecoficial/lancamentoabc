import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import EspontoneLogo from "@/components/EspontoneLogo";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const ThankYou = () => {
  const waUrl = buildWhatsAppUrl("Olá! Preenchi o formulário no site e gostaria de falar com um corretor sobre o lançamento.", "5511947723347");

  useEffect(() => {
    window.scrollTo(0, 0);
    // Auto redirect after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = waUrl;
    }, 3000);
    return () => clearTimeout(timer);
  }, [waUrl]);

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
          <a href={waUrl} className="btn-gold justify-center w-full py-4 text-base !bg-[#25D366] !text-white hover:!bg-[#20bd5a] !border-none flex items-center gap-2">
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
