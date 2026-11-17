// Lead stages (panel_leads.stage, most advanced milestone reached) and temperature labels.
export const STAGES = [
  { value: "tentou", label: "Enviou formulário", at: (l) => l.submitted_at || l.created_at, color: "#B8BEC5" },
  { value: "confirmado_rd", label: "Confirmado", at: (l) => l.rd_confirmed_at, color: "#5B95CE" },
  { value: "chegou_obrigado", label: "Página de obrigado", at: (l) => l.thank_you_at, color: "#7DB4E8" },
  { value: "foi_whatsapp", label: "Foi ao WhatsApp", at: (l) => l.whatsapp_at, color: "#4FD883" },
];

export function stageInfo(stage) {
  return STAGES.find((s) => s.value === stage) || STAGES[0];
}

export const TEMPERATURES = {
  quente: { label: "Quente", level: 3, color: "#E8877E" },
  morno: { label: "Morno", level: 2, color: "#D9BB78" },
  frio: { label: "Frio", level: 1, color: "#8FA3B8" },
};

export function temperatureInfo(t) {
  return TEMPERATURES[t] || TEMPERATURES.frio;
}
