// Central helper for WhatsApp CTAs.
// User will provide phone number later. For now we use the click-to-chat
// endpoint without number so it opens the WhatsApp chooser.

const WHATSAPP_PHONE = process.env.REACT_APP_WHATSAPP_PHONE || ""; // Ex: 5511999999999

export function buildWhatsAppUrl(message = "") {
  const encoded = encodeURIComponent(message);
  if (WHATSAPP_PHONE && WHATSAPP_PHONE.length > 0) {
    return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encoded}`;
  }
  // Opens WhatsApp with the message but no fixed recipient (chat picker).
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

export function openWhatsApp(message = "") {
  const url = buildWhatsAppUrl(message);
  window.open(url, "_blank", "noopener,noreferrer");
}

export const WA_MESSAGES = {
  hero: "Oi! Quero saber mais sobre o lançamento em São Bernardo do Campo.",
  visit: "Oi! Quero agendar uma visita ao decorado do lançamento em SBC.",
  invest: "Oi! Quero investir no lançamento em SBC. Pode me enviar a tabela e condições?",
  live: "Oi! Quero morar no lançamento em SBC. Pode me enviar as condições?",
  finalCta: "Oi! Quero falar com um corretor sobre o apartamento em SBC agora.",
  general: "Oi! Quero saber mais sobre os apartamentos em SBC.",
  plant: (metragem, config) =>
    `Oi! Tenho interesse na planta de ${metragem} (${config}) do lançamento em SBC. Pode me passar valores e condições?`,
  leadForm: (name, phone, intent, region, payment) => {
    const intentStr = intent === "invest" ? "INVESTIR" : "MORAR";
    const regionStr = region === "SBC" ? "Apenas SBC" : region === "ABC" ? "Todo o ABC" : "Santo André";
    const payStr = payment === "standard" ? "Fluxo padrão" : "Parcela Baixa + Balão";
    return `Oi! Meu nome é ${name || "[nome]"}. Quero ${intentStr} num lançamento.
Busco na região: ${regionStr}.
Preferência de pagamento: ${payStr}.
Pode me enviar os valores e opções?`;
  },
};
