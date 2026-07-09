import React from "react";
import Reveal from "@/components/Reveal";
import { Handshake, Award, Users, ShieldCheck, Sparkles } from "lucide-react";

const NUMBERS = [
  { value: "+10", label: "Anos de experiência" },
  { value: "+10.000", label: "Clientes atendidos" },
  { value: "+400", label: "Sonhos realizados" },
];

const DIFFS = [
  { icon: Handshake, title: "Atendimento consultivo", text: "Do primeiro contato ao pós-venda, cada cliente é acompanhado por um especialista." },
  { icon: Award, title: "Especialistas no ABC", text: "Profundo conhecimento do mercado — lançamentos, oportunidades e valorização da região." },
  { icon: ShieldCheck, title: "Segurança jurídica", text: "Suporte completo em contratos, documentação e financiamento." },
  { icon: Users, title: "Time humano", text: "Consultores que ouvem, comparam e defendem o seu interesse — sem pressão de venda." },
];

const AboutUs = () => {
  return (
    <section id="sobre" className="relative py-20 md:py-28 bg-gradient-to-b from-[#0A1A2E] to-[#061221]" data-testid="about-section">
      <div className="container-lp">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="section-eyebrow justify-center mb-4" style={{ display: "inline-flex" }}>Nossa História</div>
            <h2 className="section-title mb-4">
              Especialistas em <em>conectar você ao imóvel certo</em>
            </h2>
            <p className="font-sans text-base md:text-lg text-[#F5F2ED]/70 leading-relaxed">
              Nossa missão é transformar a compra do seu imóvel em uma experiência humana e consultiva. Acompanhamos cada cliente desde a primeira conversa até muito depois da entrega das chaves. Nossa equipe entende o seu perfil, seus objetivos e sua realidade financeira para apresentar a <span className="text-[#D9BB78]">oportunidade certa, no momento certo</span>.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-3xl mx-auto mb-14">
            {NUMBERS.map((n) => (
              <div key={n.label} className="text-center premium-card p-5 md:p-6">
                <div className="font-display text-3xl md:text-5xl text-gold-grad leading-none">{n.value}</div>
                <div className="font-sans text-xs md:text-sm uppercase tracking-widest text-[#F5F2ED]/60 mt-2">{n.label}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {DIFFS.map((d, i) => (
            <Reveal key={d.title} delay={i * 70}>
              <div className="premium-card p-6 h-full">
                <div className="w-11 h-11 rounded-xl bg-[#C8A45D]/15 border border-[#C8A45D]/30 flex items-center justify-center mb-4">
                  <d.icon className="text-[#D9BB78]" size={20} />
                </div>
                <h3 className="font-display text-lg text-[#F5F2ED] mb-2 leading-tight">{d.title}</h3>
                <p className="font-sans text-sm text-[#F5F2ED]/70 leading-relaxed">{d.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="font-sans text-sm text-[#F5F2ED]/50 italic max-w-2xl mx-auto">
            <Sparkles className="inline text-[#D9BB78] mr-1" size={14} /> Números ilustrativos — ajustar para os dados oficiais da Espontone antes da publicação.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutUs;
