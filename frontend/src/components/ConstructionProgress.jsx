import React, { useEffect, useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import { CONSTRUCTION_PROGRESS, CONSTRUCTION_PHOTOS } from "@/data/content";
import { HardHat, PlayCircle } from "lucide-react";

const ProgressBar = ({ label, percent }) => {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => setVal(percent), 100);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [percent]);
  return (
    <div ref={ref} data-testid={`progress-${label}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans text-sm text-[#F5F2ED]/85">{label}</span>
        <span className="font-display text-lg text-gold-grad">{val}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${val}%` }} />
      </div>
    </div>
  );
};

const ConstructionProgress = () => {
  // Duplicate photos for infinite marquee illusion
  const doubled = [...CONSTRUCTION_PHOTOS, ...CONSTRUCTION_PHOTOS];

  return (
    <section id="obra" className="relative py-20 md:py-28" data-testid="construction-section">
      <div className="container-lp">
        <Reveal>
          <div className="grid lg:grid-cols-2 gap-12 items-start mb-12">
            <div>
              <div className="section-eyebrow mb-4">Obra em andamento</div>
              <h2 className="section-title mb-5">
                Obra <em>real</em>, acontecendo agora
              </h2>
              <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70 leading-relaxed mb-4">
                Transparência do começo ao fim. Acompanhe a evolução da construção e tenha a segurança de investir em um empreendimento que <span className="text-[#D9BB78]">sai do papel</span>.
              </p>
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-[#0F2540] border border-[#C8A45D]/25">
                <HardHat size={14} className="text-[#D9BB78]" />
                <span className="font-sans text-xs uppercase tracking-widest text-[#F5F2ED]/70">Última atualização: Maio/2026 · Incorporação Paddan</span>
              </div>
            </div>

            <div className="space-y-4">
              {CONSTRUCTION_PROGRESS.map((p) => (
                <ProgressBar key={p.label} label={p.label} percent={p.percent} />
              ))}
            </div>
          </div>
        </Reveal>

        {/* Marquee gallery of construction photos */}
        <Reveal>
          <div className="marquee-wrap mb-10">
            <div className="marquee-track">
              {doubled.map((photo, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border border-[#C8A45D]/15 shrink-0" style={{ width: 300, height: 200 }}>
                  <img
                    src={photo.url}
                    alt={`Obra Landscape — Jul 2026 (${photo.id})`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement.style.background = "linear-gradient(135deg, #0F2540, #061221)";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="text-center">
          <a
            href="https://www.youtube.com/embed/Jm7_idbrcR0"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline-gold"
            data-testid="construction-video-cta"
          >
            <PlayCircle size={16} /> Ver vídeo do andamento da obra
          </a>
        </div>
      </div>
    </section>
  );
};

export default ConstructionProgress;
