import React from "react";
import Reveal from "@/components/Reveal";
import { DollarSign, Calendar, TrendingUp, Palette, Building2 } from "lucide-react";

const BENEFITS = [
  { icon: DollarSign, title: "Preço de lançamento", text: "Valor abaixo do imóvel pronto — o melhor preço do ciclo do empreendimento." },
  { icon: Calendar, title: "Parcelamento na obra", text: "Parcelas diluídas durante a construção que cabem no seu planejamento." },
  { icon: TrendingUp, title: "Valorização até a entrega", text: "Imóveis na planta tendem a valorizar durante a obra — e Santo André lidera o ABC em 2026." },
  { icon: Palette, title: "Personalização", text: "Escolha acabamentos e transforme o apartamento na sua cara antes da entrega." },
  { icon: Building2, title: "Localização nobre", text: "Av. Pereira Barreto · corredor premium com infra completa e acesso ao ABC." },
];

const WhyOffPlan = () => {
  return (
    <section id="planta" className="relative py-20 md:py-28" data-testid="why-section">
      <div className="container-lp">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="section-eyebrow justify-center mb-4" style={{ display: "inline-flex" }}>Comprar na Planta</div>
            <h2 className="section-title mb-4">
              Por que <em>comprar na planta</em> é o melhor negócio agora
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70 leading-relaxed">
              Comprar na planta significa pagar o <span className="text-[#D9BB78]">menor preço</span> do ciclo do empreendimento, com parcelamento durante a obra que cabe no seu planejamento. Até a entrega das chaves, o imóvel tende a <span className="text-[#D9BB78]">valorizar</span> — e Santo André é apontada como o ABC que mais valoriza em 2026.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 70}>
              <div className="premium-card p-6 h-full" data-testid={`benefit-${i}`}>
                <div className="w-11 h-11 rounded-xl bg-[#C8A45D]/15 border border-[#C8A45D]/30 flex items-center justify-center mb-4">
                  <b.icon className="text-[#D9BB78]" size={20} />
                </div>
                <h3 className="font-display text-xl text-[#F5F2ED] mb-2 leading-tight">{b.title}</h3>
                <p className="font-sans text-sm text-[#F5F2ED]/70 leading-relaxed">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyOffPlan;
