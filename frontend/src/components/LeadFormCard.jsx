import React, { useState } from "react";
import { openWhatsApp, WA_MESSAGES } from "@/lib/whatsapp";
import { Send } from "lucide-react";

const maskPhone = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const LeadFormCard = ({
  title = "Receba as condições de lançamento",
  subtitle = "Atendimento imediato e sem compromisso pelo WhatsApp.",
  cta = "EU QUERO AS CONDIÇÕES",
  compact = false,
  testid = "lead-form",
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState("live");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    const message = WA_MESSAGES.leadForm(name.trim(), phone.trim(), intent);
    openWhatsApp(message);
    setTimeout(() => setSubmitting(false), 800);
  };

  return (
    <form onSubmit={onSubmit} className={`form-card ${compact ? "" : "lg:max-w-md"}`} data-testid={testid}>
      <div className="mb-4">
        <div className="section-eyebrow mb-2">Fale com um corretor</div>
        <h3 className="font-display text-2xl md:text-[1.65rem] text-[#F5F2ED] leading-tight">{title}</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-[#F5F2ED]/60 mb-1 block">Nome completo</label>
          <input
            className="form-input"
            type="text"
            placeholder="Como podemos te chamar?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid={`${testid}-name`}
            required
          />
        </div>

        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-[#F5F2ED]/60 mb-1 block">WhatsApp</label>
          <input
            className="form-input"
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            data-testid={`${testid}-phone`}
            required
          />
        </div>

        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-[#F5F2ED]/60 mb-1 block">Meu interesse</label>
          <div className="form-radio-group">
            <label className={`form-radio ${intent === "live" ? "active" : ""}`}>
              <input type="radio" name="intent" value="live" className="sr-only" onChange={() => setIntent("live")} data-testid={`${testid}-intent-live`} />
              Quero morar
            </label>
            <label className={`form-radio ${intent === "invest" ? "active" : ""}`}>
              <input type="radio" name="intent" value="invest" className="sr-only" onChange={() => setIntent("invest")} data-testid={`${testid}-intent-invest`} />
              Quero investir
            </label>
          </div>
        </div>

        <button type="submit" className="btn-gold w-full mt-1" disabled={submitting} data-testid={`${testid}-submit`}>
          <Send size={16} /> {submitting ? "Abrindo WhatsApp..." : cta}
        </button>

        <p className="text-xs text-[#F5F2ED]/50 text-center font-sans leading-relaxed pt-1">
          {subtitle}
        </p>
      </div>
    </form>
  );
};

export default LeadFormCard;
