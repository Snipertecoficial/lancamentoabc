import React, { useState } from "react";
import Reveal from "@/components/Reveal";
import { FAQ_ITEMS } from "@/data/content";
import { ChevronDown } from "lucide-react";

const FAQ = () => {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="relative py-20 md:py-28 bg-gradient-to-b from-[#061221] to-[#0A1A2E]" data-testid="faq-section">
      <div className="container-lp max-w-3xl">
        <Reveal>
          <div className="text-center mb-10">
            <div className="section-eyebrow justify-center mb-4" style={{ display: "inline-flex" }}>Perguntas Frequentes</div>
            <h2 className="section-title">Ficou com <em>dúvidas</em>?</h2>
          </div>
        </Reveal>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="faq-item" data-testid={`faq-item-${i}`}>
                <button
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="w-full flex items-center justify-between text-left p-5 md:p-6"
                  aria-expanded={open === i}
                  data-testid={`faq-toggle-${i}`}
                >
                  <span className="font-display text-lg md:text-xl leading-tight pr-4">{item.q}</span>
                  <ChevronDown
                    className={`shrink-0 text-[#D9BB78] transition-transform ${open === i ? "rotate-180" : ""}`}
                    size={22}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: open === i ? "300px" : "0px" }}
                >
                  <div className="px-5 md:px-6 pb-5 md:pb-6 font-sans text-[#F5F2ED]/75 leading-relaxed">
                    {item.a}
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

export default FAQ;
