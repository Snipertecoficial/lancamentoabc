import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import EspontoneLogo from "@/components/EspontoneLogo";

const ThankYou = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
          <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-[#D9BB78]/20 text-[#D9BB78] mb-6">
            <CheckCircle size={32} />
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-[#F0F5FA] mb-4">
            Mensagem enviada com sucesso!
          </h1>
          <p className="font-sans text-[#F0F5FA]/75 text-lg leading-relaxed mb-8">
            Agradecemos o seu interesse no lançamento. Em breve, um de nossos corretores especialistas entrará em contato para apresentar as condições exclusivas e enviar o material completo.
          </p>
          <Link to="/" className="btn-gold justify-center w-full py-4 text-base">
            Voltar para a página principal
          </Link>
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
