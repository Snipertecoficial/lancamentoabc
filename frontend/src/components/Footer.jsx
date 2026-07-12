import React from "react";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";
import { Instagram, Mail, MapPin, MessageCircle, Youtube } from "lucide-react";
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
              CRECI 042656-J
            </div>
          </div>

          <div>
            <h4 className="font-display text-lg text-[#F0F5FA] mb-4">Contato</h4>
            <ul className="space-y-3 font-sans text-sm text-[#F0F5FA]/70">
              <li>
                <button onClick={() => openWhatsApp(WA_MESSAGES.general)}
                  className="flex items-center gap-2 hover:text-[#7DB4E8] transition-colors"
                  data-testid="footer-whatsapp">
                  <MessageCircle size={14} /> (11) 91049-4333
                </button>
              </li>
              <li className="flex items-center gap-2"><Mail size={14} /> contato@espontone.com.br</li>
              <li className="flex items-start gap-2 pt-1">
                <MapPin size={14} className="mt-1 shrink-0" />
                <span>Nossa Imobiliária:<br />Rua das Caneleiras, 778 - Jardim</span>
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-[#F0F5FA]/60">
              <a href="https://www.instagram.com/espontone.lancamentos/" target="_blank" rel="noreferrer" className="hover:text-[#7DB4E8] transition-colors" aria-label="Instagram">
                <Instagram size={18} />
              </a>
              <a href="https://www.youtube.com/@espontonelancamentos6728" target="_blank" rel="noreferrer" className="hover:text-[#7DB4E8] transition-colors" aria-label="YouTube">
                <Youtube size={19} />
              </a>
            </div>
            <div className="hidden md:block w-px h-4 bg-[#F0F5FA]/20"></div>
            <a href="#" className="font-sans text-xs text-[#F0F5FA]/40 hover:text-[#7DB4E8] transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
