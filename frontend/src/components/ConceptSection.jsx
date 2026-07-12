import React from "react";
import Reveal from "@/components/Reveal";
import { HERO_IMAGES } from "@/data/content";

const ConceptSection = () => {
  return (
    <section id="conceito" className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-b from-[#0A1A2E] to-[#0F2540]" data-testid="concept-section">
      <div className="container-lp grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
        <Reveal>
          <div className="section-eyebrow mb-4">O cenário perfeito para viver bem</div>
          <h2 className="section-title mb-6">
            Residencial completo com <em>lazer de resort</em>
          </h2>
          <p className="font-sans text-base md:text-lg text-[#F5F2ED]/75 leading-relaxed mb-6">
            Em localização estratégica e nobre, na <span className="text-[#D9BB78] font-semibold">Av. Pereira Barreto, em Santo André</span>, o Landscape conecta conveniência, mobilidade e conforto em um só endereço.
          </p>
          <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70 leading-relaxed mb-8">
            São <span className="text-[#D9BB78] font-semibold">mais de 40 espaços planejados</span> para oferecer bem-estar em todos os momentos — um lazer completo e surpreendente, pensado para todos os dias.
          </p>

          <div className="grid grid-cols-3 gap-4 max-w-md">
            <div className="text-center">
              <div className="font-display text-3xl md:text-4xl text-gold-grad">+40</div>
              <div className="font-sans text-xs uppercase tracking-widest text-[#]/75 mt-1">Espaços de lazer</div>
            </div>
            <div className="text-center">
              <div className="font-display text-3xl md:text-4xl text-gold-grad">5</div>
              <div className="font-sans text-xs uppercase tracking-widest text-[#]/75 mt-1">Tipologias</div>
            </div>
            <div className="text-center">
              <div className="font-display text-3xl md:text-4xl text-gold-grad">100%</div>
              <div className="font-sans text-xs uppercase tracking-widest text-[#]/75 mt-1">Suíte inclusa</div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative rounded-2xl overflow-hidden border border-[#C8A45D]/20" style={{ aspectRatio: "4/5" }}>
            <img src={HERO_IMAGES.cityscape} alt="Landscape em Santo André — vista da cidade" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#061221]/85 via-transparent to-transparent" />
            <div className="absolute left-6 bottom-6 right-6">
              <div className="section-eyebrow mb-2">Localização Premium</div>
              <h3 className="font-display text-2xl text-[#F5F2ED] leading-tight">Onde Santo André acontece</h3>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default ConceptSection;
