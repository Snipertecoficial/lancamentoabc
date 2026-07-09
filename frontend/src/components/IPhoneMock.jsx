import React from "react";
import Reveal from "@/components/Reveal";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";
import { Calendar } from "lucide-react";

const IPhoneMock = () => {
  return (
    <section id="tour" className="relative py-20 md:py-28 overflow-hidden" data-testid="iphone-section">
      {/* Soft ambient gradient */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-25"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(200,164,93,.35) 0%, transparent 70%)" }} />
      </div>

      <div className="container-lp relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left copy */}
          <Reveal>
            <div className="section-eyebrow mb-4">Tour Virtual</div>
            <h2 className="section-title mb-5">
              Conheça o <em>Landscape</em> por dentro
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70 leading-relaxed mb-6">
              Dê um passeio pelo empreendimento e imagine sua nova rotina: <span className="text-[#D9BB78]">manhãs na piscina, tardes no coworking</span> e finais de semana que cabem dentro do seu condomínio.
            </p>
            <ul className="space-y-3 mb-8 font-sans text-[#F5F2ED]/80">
              <li className="flex items-start gap-3"><span className="text-[#D9BB78] font-bold">→</span> Renderização oficial do projeto</li>
              <li className="flex items-start gap-3"><span className="text-[#D9BB78] font-bold">→</span> Vista dos apartamentos, lazer e fachada</li>
              <li className="flex items-start gap-3"><span className="text-[#D9BB78] font-bold">→</span> Perfeito para decidir com sua família</li>
            </ul>
            <button className="btn-gold" onClick={() => openWhatsApp(WA_MESSAGES.visit)} data-testid="iphone-cta-visit">
              <Calendar size={16} /> Agendar visita ao decorado
            </button>
          </Reveal>

          {/* Right iPhone */}
          <Reveal delay={150}>
            <div className="iphone-wrap">
              <div className="iphone-frame">
                <div className="iphone-glow" aria-hidden="true" />
                <div className="iphone-side-btn silent" />
                <div className="iphone-side-btn vol-up" />
                <div className="iphone-side-btn vol-down" />
                <div className="iphone-power" />
                <div className="iphone-notch" />
                <div className="iphone-screen">
                  <iframe
                    src="https://www.youtube.com/embed/9f5h628eOK4?rel=0&modestbranding=1&playsinline=1&autoplay=0"
                    title="Tour Landscape"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    data-testid="iphone-video"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default IPhoneMock;
