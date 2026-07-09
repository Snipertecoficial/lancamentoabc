import React from "react";
import { Bed, Car, Waves, Ruler, Sparkles, PlayCircle, MessageCircle, CalendarCheck } from "lucide-react";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";

const ATTRS = [
  { icon: Ruler, label: "60 a 75m²", sub: "c/ varanda" },
  { icon: Bed, label: "2 ou 3 dorms", sub: "c/ suíte" },
  { icon: Car, label: "1 ou 2 vagas", sub: "garagem" },
  { icon: Waves, label: "+40 espaços", sub: "lazer resort" },
];

const HeroSection = () => {

  return (
    <section id="top" className="relative overflow-hidden" data-testid="hero-section">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-vignette" aria-hidden="true" />

      {/* ─── TOP HALF: Text + Attributes ─── */}
      <div className="relative z-10 pt-24 md:pt-28 pb-10 md:pb-14">
        <div className="container-lp">
          <div className="max-w-4xl mx-auto text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-5">
              <Sparkles className="text-[#7DB4E8]" size={14} />
              <span className="font-sans font-semibold uppercase tracking-[0.28em] text-[0.7rem] text-[#7DB4E8]">
                Lançamento · São Bernardo do Campo
              </span>
            </div>

            {/* H1 */}
            <h1 className="font-display text-[2.2rem] leading-[1.08] md:text-[3.2rem] lg:text-[3.8rem] text-[#F0F5FA] mb-5 tracking-tight">
              A 2 minutos do <span className="text-gold-grad">Shopping Metrópole</span> — SBC
            </h1>

            {/* Subtitle */}
            <p className="font-sans text-base md:text-lg text-[#F0F5FA]/70 mb-8 max-w-3xl mx-auto leading-relaxed">
              Plantas versáteis com 2 e 3 dorms, suíte e espaço pra home office. Tudo isso pertinho de shoppings, da estação de trólebus e da futura estação de BRT — <span className="text-[#7DB4E8] font-semibold">conectando SBC com metrô Tamanduateí em 20 minutos</span>.
            </p>

            {/* Attribute cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto mb-8">
              {ATTRS.map((a, i) => (
                <div key={i} className="premium-card p-3 md:p-4 text-center" data-testid={`hero-attr-${i}`}>
                  <a.icon className="mx-auto text-[#7DB4E8] mb-2" size={22} />
                  <div className="font-display text-sm md:text-base text-[#F0F5FA] leading-tight">{a.label}</div>
                  <div className="font-sans text-[0.68rem] uppercase tracking-widest text-[#F0F5FA]/50 mt-1">{a.sub}</div>
                </div>
              ))}
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <button className="btn-gold" onClick={() => openWhatsApp(WA_MESSAGES.hero)} data-testid="hero-cta-whatsapp">
                <PlayCircle size={16} /> Quero condições exclusivas
              </button>
              <a href="#plantas" className="btn-outline-gold" data-testid="hero-cta-plants">
                Ver plantas
              </a>
            </div>

            {/* Urgency badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5B95CE]/10 border border-[#5B95CE]/30">
              <span className="w-2 h-2 bg-[#7DB4E8] rounded-full animate-pulse" />
              <span className="font-sans text-xs uppercase tracking-widest text-[#7DB4E8] font-semibold">
                Lançamento — unidades limitadas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM HALF: Video + CTA ─── */}
      <div className="relative z-10 pb-16 md:pb-24">
        <div className="container-lp">
          {/* Device mock with video */}
          <div className="flex justify-center mb-8">
            <div className="device-mock">
              <div className="device-mock-glow" aria-hidden="true" />
              <div className="device-mock-notch" />
              <div className="device-mock-screen">
                <iframe
                  className="w-full h-full object-cover"
                  src="https://www.youtube.com/embed/MBYgQBK6XJc?autoplay=1&mute=1&loop=1&playlist=MBYgQBK6XJc&controls=0&playsinline=1&modestbranding=1&rel=0"
                  title="Tour Virtual"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  data-testid="hero-video"
                ></iframe>
              </div>
            </div>
          </div>

          {/* Video CTA strip */}
          <div className="max-w-3xl mx-auto">
            <div className="hero-video-cta-strip">
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg md:text-xl text-[#F0F5FA] leading-tight mb-1">
                  Gostou do que viu?
                </p>
                <p className="font-sans text-sm text-[#F0F5FA]/60 leading-snug">
                  Agende uma visita ao plantão ou fale direto com um corretor especialista.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
                <button
                  className="btn-gold whitespace-nowrap"
                  onClick={() => openWhatsApp(WA_MESSAGES.visit)}
                  data-testid="hero-cta-visit"
                >
                  <CalendarCheck size={16} /> Agendar visita
                </button>
                <button
                  className="btn-outline-gold whitespace-nowrap"
                  onClick={() => openWhatsApp(WA_MESSAGES.finalCta)}
                  data-testid="hero-cta-talk"
                >
                  <MessageCircle size={16} /> Falar com corretor
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
