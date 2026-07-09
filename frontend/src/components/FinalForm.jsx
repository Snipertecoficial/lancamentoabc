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
            <div className="section-eyebrow mb-4">Próximo passo</div>
            <h2 className="section-title mb-5">
              Garanta sua <em>unidade</em> no Landscape
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/75 leading-relaxed mb-6 max-w-xl">
              As melhores unidades saem primeiro. Fale agora com um corretor especialista e receba <span className="text-[#D9BB78]">tabela de valores, plantas e condições exclusivas de lançamento</span>.
            </p>
            <ul className="space-y-3 font-sans text-[#F5F2ED]/80">
              <li className="flex items-start gap-3"><span className="text-[#D9BB78]">✓</span> Tabela oficial de vendas atualizada</li>
              <li className="flex items-start gap-3"><span className="text-[#D9BB78]">✓</span> Simulação financeira sob medida</li>
              <li className="flex items-start gap-3"><span className="text-[#D9BB78]">✓</span> Reserva de unidade com melhor vista</li>
              <li className="flex items-start gap-3"><span className="text-[#D9BB78]">✓</span> Atendimento humano — sem robotização</li>
            </ul>
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
