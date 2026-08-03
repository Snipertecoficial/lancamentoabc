import React from "react";
import Reveal from "@/components/Reveal";
import LeadFormCard from "@/components/LeadFormCard";
import { HERO_IMAGES } from "@/data/content";
import { Bed, Car } from "lucide-react";

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
              Antecipe-se e garanta as melhores condições de <span className="text-[#D9BB78]">Lançamento</span>. Escolha a opção ideal para a sua família:
            </p>
            <ul className="space-y-4 font-sans text-[#F5F2ED] mb-6">
              <li className="flex items-center justify-between gap-4 bg-[#0A1A2E]/80 p-4 rounded-xl border border-[#D9BB78]/30 hover:border-[#D9BB78]/60 transition-all shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#D9BB78]/10 flex items-center justify-center text-[#D9BB78]">
                    <Bed size={20} />
                  </div>
                  <div>
                    <span className="text-base md:text-lg font-display text-[#F5F2ED] font-semibold block">2 Dormitórios</span>
                    <span className="text-xs text-[#F5F2ED]/70">Planta inteligente com suíte e varanda</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#D9BB78]/15 text-[#D9BB78] text-xs font-semibold uppercase tracking-wider border border-[#D9BB78]/30">Lançamento</span>
              </li>

              <li className="flex items-center justify-between gap-4 bg-[#0A1A2E]/80 p-4 rounded-xl border border-[#D9BB78]/30 hover:border-[#D9BB78]/60 transition-all shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#D9BB78]/10 flex items-center justify-center text-[#D9BB78]">
                    <Bed size={20} />
                  </div>
                  <div>
                    <span className="text-base md:text-lg font-display text-[#F5F2ED] font-semibold block">3 Dormitórios</span>
                    <span className="text-xs text-[#F5F2ED]/70">1 vaga de garagem</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D9BB78]/15 text-[#D9BB78] text-xs font-semibold uppercase tracking-wider border border-[#D9BB78]/30">
                  <Car size={12} />
                  <span>1 Vaga</span>
                </div>
              </li>

              <li className="flex items-center justify-between gap-4 bg-[#0A1A2E]/80 p-4 rounded-xl border border-[#D9BB78]/30 hover:border-[#D9BB78]/60 transition-all shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#D9BB78]/10 flex items-center justify-center text-[#D9BB78]">
                    <Bed size={20} />
                  </div>
                  <div>
                    <span className="text-base md:text-lg font-display text-[#F5F2ED] font-semibold block">3 Dormitórios</span>
                    <span className="text-xs text-[#F5F2ED]/70">2 vagas de garagem</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D9BB78]/15 text-[#D9BB78] text-xs font-semibold uppercase tracking-wider border border-[#D9BB78]/30">
                  <Car size={12} />
                  <span>2 Vagas</span>
                </div>
              </li>
            </ul>
            <p className="text-sm text-[#]/75 italic">
              * Condições especiais de fluxo de pagamento facilitado durante o período de obras.
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
