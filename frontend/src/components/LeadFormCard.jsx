import React, { useEffect } from "react";
import { LEAD_FORM_ID } from "@/lib/tracking";

const LeadFormCard = ({
  compact = false,
  testid = "lead-form",
}) => {
  useEffect(() => {
    const configureSuccessRedirect = () => {
      const container = document.getElementById(LEAD_FORM_ID);
      const form = container?.querySelector("form");
      if (!form) return false;

      let redirectInput = form.querySelector('input[name="redirect_to"]');
      if (!redirectInput) {
        redirectInput = document.createElement("input");
        redirectInput.type = "hidden";
        redirectInput.name = "redirect_to";
        form.appendChild(redirectInput);
      }
      redirectInput.value = `${window.location.origin}/obrigado`;
      return true;
    };

    const container = document.getElementById(LEAD_FORM_ID);
    const observer = new MutationObserver(() => {
      if (configureSuccessRedirect()) observer.disconnect();
    });
    if (container) observer.observe(container, { childList: true, subtree: true });

    // Inject RD Station script if not present
    if (!document.getElementById("rd-station-script")) {
      const script = document.createElement("script");
      script.id = "rd-station-script";
      script.src = "https://d335luupugsy2.cloudfront.net/js/rdstation-forms/stable/rdstation-forms.min.js";
      script.type = "text/javascript";
      script.async = true;
      script.onload = () => {
        if (window.RDStationForms) {
          new window.RDStationForms(LEAD_FORM_ID, 'null').createForm();
          configureSuccessRedirect();
        }
      };
      document.body.appendChild(script);
    } else {
      // If script is already there, just create the form (e.g. navigation)
      if (window.RDStationForms) {
        // Clear container to avoid duplicates if re-rendered
        const container = document.getElementById(LEAD_FORM_ID);
        if (container) container.innerHTML = "";
        new window.RDStationForms(LEAD_FORM_ID, 'null').createForm();
        configureSuccessRedirect();
      }
    }

    return () => observer.disconnect();
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
        <div role="main" id={LEAD_FORM_ID} className="rd-custom-form"></div>
      </div>
    </div>
  );
};

export default LeadFormCard;
