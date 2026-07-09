import React from "react";
import Reveal from "@/components/Reveal";
import LeadFormCard from "@/components/LeadFormCard";
import { HERO_IMAGES } from "@/data/content";

const FinalForm = () => {
  return (
    <section id="contato" className="relative py-20 md:py-28 overflow-hidden" data-testid="final-form-section">
      {/* Bg image + overlay */}
      <div className="absolute inset-0" aria-hidden="true">
        <img src={HERO_IMAGES.facade} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A1A2E] via-[#0A1A2E]/95 to-[#061221]" />
      </div>

      <div className="container-lp relative z-10">
        <div className="grid lg:grid-cols-[1fr_460px] gap-10 lg:gap-16 items-center">
          <Reveal>
            <div className="section-eyebrow mb-4 bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-4 py-1 inline-block rounded-full">OFERTA POR TEMPO LIMITADO</div>
            <h2 className="section-title mb-5">
              Garanta sua <em>unidade</em> neste Lançamento
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/75 leading-relaxed mb-6 max-w-xl">
              Antecipe-se e garanta as melhores condições de <span className="text-[#D9BB78]">Lançamento (entrega em 3 anos)</span>. Montamos um fluxo personalizado para caber no seu bolso:
            </p>
            <ul className="space-y-4 font-sans text-[#F5F2ED] mb-6">
              <li className="flex items-center gap-4 bg-[#0A1A2E]/50 p-3 rounded-lg border border-[#D9BB78]/20">
                <span className="text-xl font-display text-[#D9BB78] min-w-[70px]">60 m²</span>
                <span className="text-sm md:text-base text-[#F5F2ED]/80">Mensais a partir de <strong className="text-white">R$ 3.900</strong></span>
              </li>
              <li className="flex items-center gap-4 bg-[#0A1A2E]/50 p-3 rounded-lg border border-[#D9BB78]/20">
                <span className="text-xl font-display text-[#D9BB78] min-w-[70px]">68 m²</span>
                <span className="text-sm md:text-base text-[#F5F2ED]/80">Mensais a partir de <strong className="text-white">R$ 4.900</strong></span>
              </li>
              <li className="flex items-center gap-4 bg-[#0A1A2E]/50 p-3 rounded-lg border border-[#D9BB78]/20">
                <span className="text-xl font-display text-[#D9BB78] min-w-[70px]">74 m²</span>
                <span className="text-sm md:text-base text-[#F5F2ED]/80">Mensais a partir de <strong className="text-white">R$ 5.200</strong></span>
              </li>
            </ul>
            <p className="text-sm text-[#F5F2ED]/60 italic">
              * Prefere uma parcela mais baixa? Aceitamos entrada facilitada e parcela balão.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <div className="w-full">
              <LeadFormCard
                title="Falar com corretor agora"
                cta="FALAR COM CORRETOR"
                testid="final-lead-form"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default FinalForm;
