import React from "react";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import EspontoneLogo from "@/components/EspontoneLogo";

const Footer = () => {
  return (
    <footer className="relative bg-[#061224] pt-14 pb-8 border-t border-[#5B95CE]/18" data-testid="footer">
      <div className="container-lp">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="mb-4"><EspontoneLogo /></div>
            <p className="font-sans text-sm text-[#F0F5FA]/60 leading-relaxed mb-4 max-w-md">
              Especialistas em conectar você ao imóvel certo no ABC Paulista.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#F0F5FA]/50 uppercase tracking-widest font-sans font-semibold">
              CRECI-J XX.XXX (a ajustar)
            </div>
          </div>

          <div>
            <h4 className="font-display text-lg text-[#F0F5FA] mb-4">Contato</h4>
            <ul className="space-y-3 font-sans text-sm text-[#F0F5FA]/70">
              <li>
                <button onClick={() => openWhatsApp(WA_MESSAGES.general)}
                  className="flex items-center gap-2 hover:text-[#7DB4E8] transition-colors"
                  data-testid="footer-whatsapp">
                  <MessageCircle size={14} /> WhatsApp
                </button>
              </li>
              <li className="flex items-center gap-2"><Mail size={14} /> contato@espontone.com.br</li>
              <li className="flex items-center gap-2"><Instagram size={14} /> @espontone.lancamentos</li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="mt-1" />
                <span>Plantão de vendas<br />Av. Pereira Barreto, 1981<br />Santo André / SP</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-lg text-[#F0F5FA] mb-4">Navegação</h4>
            <ul className="space-y-2 font-sans text-sm text-[#F0F5FA]/70">
              <li><a href="#plantas" className="hover:text-[#7DB4E8] transition-colors">Plantas</a></li>
              <li><a href="#localizacao" className="hover:text-[#7DB4E8] transition-colors">Localização</a></li>
              <li><a href="#faq" className="hover:text-[#7DB4E8] transition-colors">Dúvidas</a></li>
              <li><a href="#contato" className="hover:text-[#7DB4E8] transition-colors">Contato</a></li>
              <li><a href="#galeria3d" className="hover:text-[#7DB4E8] transition-colors">Galeria imersiva</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-sans text-xs text-[#F0F5FA]/40">
            © {new Date().getFullYear()} Espontone Imóveis. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-4 font-sans text-xs text-[#F0F5FA]/40">
            <a href="#" className="hover:text-[#7DB4E8] transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
