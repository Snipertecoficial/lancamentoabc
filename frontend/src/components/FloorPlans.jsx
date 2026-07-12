import React from "react";
import Reveal from "@/components/Reveal";
import { FLOOR_PLANS } from "@/data/content";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";
import { Home, ArrowRight, BedDouble } from "lucide-react";

const FloorPlans = () => {
  return (
    <section id="plantas" className="relative py-20 md:py-28 bg-gradient-to-b from-[#0A1A2E] to-[#061221]" data-testid="floorplans-section">
      <div className="container-lp">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="section-eyebrow justify-center mb-4" style={{ display: "inline-flex" }}>Plantas</div>
            <h2 className="section-title mb-4">Plantas inteligentes de <em>60 a 75m²</em></h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70">
              Escolha a metragem e a distribuição que combinam com o seu momento. Comprando na planta, você ainda <span className="text-[#D9BB78]">personaliza acabamentos</span>.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {FLOOR_PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 80}>
              <div className="premium-card p-6 md:p-7 h-full flex flex-col relative overflow-hidden" data-testid={`plan-card-${plan.id}`}>
                {plan.tag && (
                  <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#D9BB78] to-[#A88641] text-[0.65rem] font-bold tracking-widest text-[#0A1A2E] uppercase">
                    {plan.tag}
                  </div>
                )}
                <Home className="text-[#D9BB78] mb-4" size={26} />
                <div className="font-display text-4xl md:text-5xl text-gold-grad leading-none">{plan.area}</div>
                <div className="font-sans text-sm uppercase tracking-widest text-[#]/75 mt-1 mb-5">{plan.label}</div>
                <div className="flex items-start gap-2 mb-2 text-[#F5F2ED]/90">
                  <BedDouble size={18} className="text-[#D9BB78] mt-0.5 shrink-0" />
                  <span className="font-sans text-sm md:text-base">{plan.dorms}</span>
                </div>
                <p className="font-sans text-sm text-[#F5F2ED]/65 leading-relaxed mb-6">{plan.highlight}</p>

                <div className="mt-auto">
                  <button
                    className="btn-outline-gold w-full justify-center"
                    onClick={() => openWhatsApp(WA_MESSAGES.plant(plan.area, plan.dorms))}
                    data-testid={`plan-cta-${plan.id}`}
                  >
                    Quero esta planta <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="font-sans text-sm text-[#]/75 italic">
            * As metragens e configurações finais são confirmadas na tabela oficial de vendas.
          </p>
        </div>
      </div>
    </section>
  );
};

export default FloorPlans;
