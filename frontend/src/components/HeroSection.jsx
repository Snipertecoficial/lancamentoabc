import React, { useRef, useState } from "react";
import { Bed, Car, Waves, Ruler, Sparkles, PlayCircle, MessageCircle, CalendarCheck, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";

const ATTRS = [
  { icon: Sparkles, label: "Varanda Gourmet", sub: "Lançamento SBC" },
  { icon: Bed, label: "2 ou 3 dorms", sub: "c/ suíte" },
  { icon: Car, label: "1 ou 2 vagas", sub: "garagem" },
  { icon: Waves, label: "+40 espaços", sub: "lazer resort" },
];

const HeroSection = () => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <section id="top" className="relative overflow-hidden" data-testid="hero-section">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-vignette" aria-hidden="true" />

      {/* ─── TOP HALF: Text + Attributes ─── */}
      <div className="relative z-10 pt-24 md:pt-28 pb-10 md:pb-14">
        <div className="container-lp">
          {/* Phones: buttons come right after the text (before the cards), so they show on the first screen. */}
          <div className="max-w-4xl mx-auto text-center flex flex-col sm:block">
            {/* Eyebrow */}
            <div className="inline-flex self-center items-center gap-2 mb-5">
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
            <div className="order-2 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full mx-auto mb-8">
              {ATTRS.map((a, i) => (
                <div key={i} className="premium-card p-3 md:p-4 text-center" data-testid={`hero-attr-${i}`}>
                  <a.icon className="mx-auto text-[#7DB4E8] mb-2" size={22} />
                  <div className="font-display text-sm md:text-base text-[#F0F5FA] leading-tight">{a.label}</div>
                  <div className="font-sans text-[0.68rem] uppercase tracking-widest text-[#]/75 mt-1">{a.sub}</div>
                </div>
              ))}
            </div>

            {/* Primary CTAs */}
            <div className="order-1 sm:order-none flex flex-wrap items-center justify-center gap-3 mb-6 sm:mb-4" data-hero-ctas="">
              <button className="btn-gold" onClick={() => openWhatsApp(WA_MESSAGES.hero, "hero_cta_whatsapp")} data-testid="hero-cta-whatsapp">
                <PlayCircle size={16} /> Quero condições exclusivas
              </button>
              <a href="#contato" className="btn-outline-gold" data-testid="hero-cta-unit">
                Garanta sua unidade
              </a>
            </div>

            {/* Urgency badge */}
            <div className="order-3 self-center inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5B95CE]/10 border border-[#5B95CE]/30">
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
                <video
                  ref={videoRef}
                  data-radar-video="hero"
                  className="w-full h-full object-cover"
                  poster="/tour-poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label="Tour Virtual"
                  data-testid="hero-video"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onVolumeChange={(e) => setIsMuted(e.currentTarget.muted)}
                >
                  <source src="/tour-video.mp4" type="video/mp4" />
                </video>

                <div className="hero-video-controls">
                  <button
                    type="button"
                    className="hero-video-btn"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pausar vídeo" : "Tocar vídeo"}
                    data-testid="hero-video-play-toggle"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    type="button"
                    className="hero-video-btn"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Ativar som" : "Desativar som"}
                    data-testid="hero-video-mute-toggle"
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </div>
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
                <p className="font-sans text-sm text-[#]/75 leading-snug">
                  Agende uma visita ao plantão ou fale direto com um corretor especialista.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
                <button
                  className="btn-gold whitespace-nowrap"
                  onClick={() => openWhatsApp(WA_MESSAGES.visit, "hero_agendar_visita")}
                  data-testid="hero-cta-visit"
                >
                  <CalendarCheck size={16} /> Agendar visita
                </button>
                <button
                  className="btn-outline-gold whitespace-nowrap"
                  onClick={() => openWhatsApp(WA_MESSAGES.finalCta, "hero_falar_corretor")}
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
