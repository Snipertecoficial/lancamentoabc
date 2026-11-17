import React from "react";
import LeadForm from "@/components/LeadForm";

const LeadFormCard = ({
  compact = false,
  testid = "lead-form",
}) => {
  return (
    // id="rd-form-section" kept as an alias: CTAs (openWhatsApp) and the radar form_view collector use it.
    <div id="rd-form-section" className={`form-card !p-5 md:!p-6 ${compact ? "" : "lg:max-w-[400px] mx-auto"} relative`} data-testid={testid}>
      <div className="mb-3 text-center">
        <div className="section-eyebrow mb-1 text-[0.65rem]">Garanta sua unidade</div>
        <h3 className="font-display text-xl md:text-[1.4rem] text-[#F5F2ED] leading-tight">
          Receba as tabelas do lançamento
        </h3>
        <p className="text-[#F0F5FA]/75 text-xs mt-2 font-sans px-2">
          Preencha para liberar o atendimento.
        </p>
      </div>

      <div id="form-lead" className="mt-4 rounded-lg transition-shadow duration-500">
        <LeadForm />
      </div>
    </div>
  );
};

export default LeadFormCard;
