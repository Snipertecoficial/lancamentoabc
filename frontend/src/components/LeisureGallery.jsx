import React, { useState } from "react";
import Reveal from "@/components/Reveal";
import { LEISURE_CATEGORIES } from "@/data/content";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";

const LeisureGallery = () => {
  const [active, setActive] = useState(LEISURE_CATEGORIES[0].id);
  const current = LEISURE_CATEGORIES.find((c) => c.id === active) || LEISURE_CATEGORIES[0];

  return (
    <section id="lazer" className="relative py-20 md:py-28" data-testid="leisure-section">
      <div className="container-lp">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="section-eyebrow justify-center mb-4" style={{ display: "inline-flex" }}>Lazer de Resort</div>
            <h2 className="section-title mb-4">
              <em>Mais de 40 espaços</em> para viver bem todos os dias
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70">
              Tudo o que sua família precisa, sem precisar sair de casa.
            </p>
          </div>
        </Reveal>

        {/* Category tabs */}
        <Reveal delay={100}>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10" data-testid="leisure-tabs">
            {LEISURE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={`px-4 md:px-5 py-2.5 rounded-full font-sans font-semibold text-sm transition-all border ${
                  active === cat.id
                    ? "bg-gradient-to-r from-[#D9BB78] to-[#A88641] text-[#0A1A2E] border-transparent shadow-lg"
                    : "border-[#C8A45D]/30 text-[#F5F2ED]/75 hover:text-[#F5F2ED] hover:border-[#C8A45D]/60"
                }`}
                data-testid={`leisure-tab-${cat.id}`}
              >
                <span className="mr-1.5">{cat.icon}</span> {cat.title}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5" data-testid="leisure-grid">
          {current.items.map((item, i) => (
            <Reveal key={`${current.id}-${item.name}`} delay={i * 60}>
              <div className="gallery-card group">
                <img
                  src={item.url}
                  alt={`${item.name} — Landscape Santo André`}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement.style.background =
                      "linear-gradient(135deg, #0F2540, #061221)";
                  }}
                />
                <div className="caption">{item.name}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="btn-gold" onClick={() => openWhatsApp(WA_MESSAGES.visit)} data-testid="leisure-cta">
            Ver plantas disponíveis
          </button>
        </div>
      </div>
    </section>
  );
};

export default LeisureGallery;
