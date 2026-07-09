import React from "react";
import Reveal from "@/components/Reveal";
import { TESTIMONIALS } from "@/data/content";
import { Quote, Star } from "lucide-react";

const Testimonials = () => {
  return (
    <section id="depoimentos" className="relative py-20 md:py-28" data-testid="testimonials-section">
      <div className="container-lp">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="section-eyebrow justify-center mb-4" style={{ display: "inline-flex" }}>Avaliações Google</div>
            <h2 className="section-title mb-4">
              O que nossos <em>clientes dizem</em>
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70">Histórias reais de quem confiou na Espontone.</p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5 md:gap-6">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div className="premium-card p-6 md:p-7 h-full relative" data-testid={`testimonial-${i}`}>
                <Quote className="text-[#C8A45D]/40 absolute top-5 right-5" size={40} />
                <div className="stars mb-4">
                  {Array.from({ length: t.rating }).map((_, k) => (
                    <Star key={k} size={16} className="inline fill-current" />
                  ))}
                </div>
                <p className="font-sans text-base text-[#F5F2ED]/85 leading-relaxed mb-5">“{t.text}”</p>
                <div className="flex items-center gap-3 pt-4 border-t border-[#C8A45D]/15">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D9BB78] to-[#A88641] flex items-center justify-center font-display font-bold text-[#0A1A2E]">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-sans font-semibold text-sm text-[#F5F2ED]">{t.name}</div>
                    <div className="font-sans text-xs text-[#F5F2ED]/50">Avaliação no Google</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
