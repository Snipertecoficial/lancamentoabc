import React, { useEffect, useState } from "react";
import { Menu, X, MessageCircle } from "lucide-react";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";
import EspontoneLogo from "@/components/EspontoneLogo";

const NAV = [
  { label: "Plantas", href: "#plantas" },
  { label: "Localização", href: "#localizacao" },
  { label: "Dúvidas", href: "#faq" },
  { label: "Contato", href: "#contato" },
];

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`} data-testid="site-header">
      <div className="container-lp flex items-center justify-between h-16 md:h-20">
        <a href="#top" data-testid="brand-logo" className="flex items-center gap-3">
          <EspontoneLogo />
        </a>

        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}
              className="font-sans text-sm text-[#F0F5FA]/75 hover:text-[#7DB4E8] transition-colors"
              data-testid={`nav-${item.href.slice(1)}`}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <button className="btn-gold"
              onClick={() => openWhatsApp(WA_MESSAGES.hero)}
              data-testid="header-cta-whatsapp">
              <MessageCircle size={16} /> Fale com corretor
            </button>
          </div>
          <button className="lg:hidden text-[#F0F5FA] p-2" onClick={() => setOpen((v) => !v)}
            aria-label="Menu" data-testid="mobile-menu-toggle">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <div 
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        
        {/* Drawer */}
        <div 
          className={`absolute top-0 right-0 bottom-0 w-64 max-w-[80vw] bg-[#0A1930] border-l border-[#C8A45D]/20 shadow-2xl transition-transform duration-300 ease-out flex flex-col ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-end p-4 h-16 md:h-20 border-b border-[#F5F2ED]/10">
            <button className="text-[#F0F5FA] p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>
          
          <div className="flex flex-col gap-2 p-6 overflow-y-auto flex-1">
            <div className="text-xs uppercase tracking-widest text-[#D9BB78] mb-4 font-semibold">Navegação</div>
            {NAV.map((item) => (
              <a key={item.href} href={item.href}
                className="font-display text-2xl text-[#F0F5FA] py-3 border-b border-white/5 hover:text-[#7DB4E8] transition-colors"
                onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="p-6 border-t border-[#F5F2ED]/10">
            <button className="btn-gold w-full justify-center py-4"
              onClick={() => { setOpen(false); openWhatsApp(WA_MESSAGES.hero); }}>
              <MessageCircle size={18} className="mr-2" /> Fale com corretor
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
