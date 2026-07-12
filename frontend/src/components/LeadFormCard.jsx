import React, { useEffect } from "react";

const LeadFormCard = ({
  compact = false,
  testid = "lead-form",
}) => {
  useEffect(() => {
    // Inject RD Station script if not present
    if (!document.getElementById("rd-station-script")) {
      const script = document.createElement("script");
      script.id = "rd-station-script";
      script.src = "https://d335luupugsy2.cloudfront.net/js/rdstation-forms/stable/rdstation-forms.min.js";
      script.type = "text/javascript";
      script.async = true;
      script.onload = () => {
        if (window.RDStationForms) {
          new window.RDStationForms('espontone-16aa058dd608303c1ceb', 'null').createForm();
        }
      };
      document.body.appendChild(script);
    } else {
      // If script is already there, just create the form (e.g. navigation)
      if (window.RDStationForms) {
        // Clear container to avoid duplicates if re-rendered
        const container = document.getElementById("espontone-16aa058dd608303c1ceb");
        if (container) container.innerHTML = "";
        new window.RDStationForms('espontone-16aa058dd608303c1ceb', 'null').createForm();
    }
  }, []);

  return (
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

      <div className="mt-4">
        {/* RD Station Container */}
        <div role="main" id="espontone-16aa058dd608303c1ceb" className="rd-custom-form"></div>
      </div>
    </div>
  );
};

export default LeadFormCard;
