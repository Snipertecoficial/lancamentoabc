import React from "react";
import Reveal from "@/components/Reveal";
import { LOCATION } from "@/data/content";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";
import { MapPin } from "lucide-react";

const LocationSection = () => {
  return (
    <section id="localizacao" className="relative py-20 md:py-28 bg-gradient-to-b from-[#061221] to-[#0A1A2E]" data-testid="location-section">
      <div className="container-lp">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="section-eyebrow justify-center mb-4" style={{ display: "inline-flex" }}>Localização</div>
            <h2 className="font-display text-3xl md:text-5xl text-[#F5F2ED] mb-4">
              Em <span className="text-[#D9BB78] italic">São Bernardo</span>, tudo perto de você
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70">
              Viver no coração de São Bernardo do Campo significa ter tudo ao seu redor. A apenas 2 minutos do Shopping Metrópole e cercado pelos melhores serviços da cidade. Com o futuro <span className="text-[#D9BB78]">BRT-ABC</span> e a facilidade do Trólebus, você tem mobilidade total, conectando SBC ao <span className="text-[#D9BB78]">metrô Tamanduateí em apenas 20 minutos</span>. Mais qualidade de vida e alta valorização para o seu imóvel.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0F2540] border border-[#C8A45D]/25">
              <MapPin size={14} className="text-[#D9BB78]" />
              <span className="font-sans text-sm text-[#F5F2ED]/85">{LOCATION.address}</span>
            </div>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-10">
          <Reveal>
            <div className="rounded-2xl overflow-hidden border border-[#C8A45D]/20 aspect-[4/3] lg:aspect-auto lg:h-full min-h-[380px]">
              <iframe
                src={LOCATION.mapEmbed}
                title="Localização Landscape em Santo André"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                data-testid="location-map"
              />
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {LOCATION.poi.map((cat) => (
                <div key={cat.title} className="premium-card p-4 md:p-5">
                  <div className="section-eyebrow mb-3">{cat.title}</div>
                  <ul className="font-sans text-sm text-[#F5F2ED]/80 space-y-1.5">
                    {cat.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <span className="text-[#D9BB78] mt-1">•</span> {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="text-center mt-12">
          <button className="btn-gold" onClick={() => openWhatsApp(WA_MESSAGES.live)} data-testid="location-cta">
            Quero morar aqui
          </button>
        </div>
      </div>
    </section>
  );
};

export default LocationSection;
