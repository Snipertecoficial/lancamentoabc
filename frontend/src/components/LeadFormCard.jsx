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
    }

    // Force redirection if RD Station's own redirect fails or is delayed.
    // RD Station dispatches a postMessage on successful conversion.
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'RDSTATION_FORM_CONVERSION') {
        window.location.href = '/obrigado';
      }
    };
    window.addEventListener("message", handleMessage);

    // Fallback Observer: If RD Station form converts to a success message (pop-up/text inside the div)
    const observer = new MutationObserver((mutations) => {
      const container = document.getElementById("espontone-16aa058dd608303c1ceb");
      if (container) {
        const text = container.innerText.toLowerCase();
        // RD station standard success texts
        if (text.includes("sucesso") || text.includes("obrigado") || text.includes("agradecemos")) {
          // ensure the form is gone
          if (!container.querySelector("form")) {
            window.location.href = '/obrigado';
          }
        }
      }
    });

    const rdSection = document.getElementById("rd-form-section");
    if (rdSection) {
      observer.observe(rdSection, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      observer.disconnect();
    };
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
