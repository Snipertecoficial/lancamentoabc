// Radar events (panel_lead_events) as plain Portuguese sentences for the lead timeline.
// Only known, human fields are ever printed: never lead_token, ip_hash or raw props.
import { formatSeconds } from "./timeline";

export const SECTION_LABELS = {
  top: "Topo/vídeo",
  "hero-section": "Topo/vídeo",
  faq: "Dúvidas",
  "faq-section": "Dúvidas",
  contato: "Formulário",
  "final-form-section": "Formulário",
  galeria3d: "Galeria",
  "slider3d-section": "Galeria",
  sobre: "Sobre o empreendimento",
  "about-section": "Sobre o empreendimento",
  conceito: "Conceito",
  "concept-section": "Conceito",
  lazer: "Lazer",
  "leisure-section": "Lazer",
  plantas: "Plantas",
  planta: "Plantas",
  "floorplans-section": "Plantas",
  localizacao: "Localização",
  "location-section": "Localização",
  obra: "Obra",
  "construction-section": "Obra",
  depoimentos: "Depoimentos",
  "testimonials-section": "Depoimentos",
  tour: "Tour",
  "iphone-section": "Vídeo no celular",
  "why-section": "Por que escolher",
};

export const CTA_LABELS = {
  "hero-cta-whatsapp": "Receber condições no WhatsApp",
  "hero-cta-unit": "Garanta sua unidade",
  "hero-cta-visit": "Agendar visita",
  "hero-cta-talk": "Falar com corretor",
  "header-cta-whatsapp": "Fale com corretor (topo)",
  "hero-video-mute-toggle": "Som do vídeo",
  "hero-video-play-toggle": "Play/pause do vídeo",
  "footer-whatsapp": "WhatsApp do rodapé",
};

const FIELD_LABELS = { name: "Nome", phone: "Celular", mobile_phone: "Celular", email: "E-mail", intent: "Objetivo" };
const INTENT_LABELS = { morar: "quer morar", investir: "quer investir" };
// openWhatsAppDirect `location` values -> where the visitor clicked.
const DIRECT_SOURCES = {
  floating_whatsapp: "botão flutuante",
  header_desktop: "Fale com corretor, topo",
  header_mobile: "Fale com corretor, menu do celular",
  hero_falar_corretor: "Falar com corretor",
  footer: "telefone do rodapé",
};
const MILESTONES = new Set(["lead_submitted", "thank_you_view", "whatsapp_click"]);
const FALLBACK = "Outra interação na página";

const str = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const num = (v) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const clip = (s, max = 60) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const quoted = (s) => `“${clip(s)}”`;

export function sectionLabel(id) {
  return SECTION_LABELS[str(id)] || "";
}

// A click label is a data-testid (mapped to the button's text) or the element's own text.
export function ctaLabel(label) {
  const l = str(label);
  if (!l) return "";
  if (CTA_LABELS[l]) return CTA_LABELS[l];
  let m = /^faq-toggle-(\d+)$/.exec(l);
  if (m) return `Dúvida ${Number(m[1]) + 1}`;
  m = /^slider3d-dot-(\d+)$/.exec(l);
  if (m) return `Foto ${Number(m[1]) + 1} da galeria`;
  return clip(l);
}

function sectionPhrase(section) {
  const id = str(section);
  if (!id) return "uma seção da página";
  const known = sectionLabel(id);
  return known ? `a seção ${known}` : `a seção ${quoted(id)}`;
}

function videoLabel(name, p) {
  switch (name) {
    case "play": return "Deu play no vídeo";
    case "pause": return "Pausou o vídeo";
    case "unmute": return "Ativou o som do vídeo";
    case "progress": {
      const pct = num(p.pct);
      return pct === null ? "Assistiu parte do vídeo" : `Assistiu até ${Math.round(pct)}% do vídeo`;
    }
    default: return "Interagiu com o vídeo";
  }
}

export function labelFor(event) {
  if (!event || typeof event !== "object") return FALLBACK;
  const p = event.props && typeof event.props === "object" ? event.props : {};
  switch (event.type) {
    case "page_view": {
      const path = str(p.path).split(/[?#]/)[0];
      return path && path !== "/" ? `Entrou na página ${clip(path)}` : "Entrou na página";
    }
    case "video":
      return videoLabel(event.name, p);
    case "faq_open": {
      const q = str(p.question);
      return q ? `Abriu a dúvida: ${clip(q, 120)}` : "Abriu uma dúvida";
    }
    case "section_view": {
      const s = num(p.seconds);
      const base = `Viu ${sectionPhrase(event.section)}`;
      return s !== null && s > 0 ? `${base} por ${formatSeconds(s)}` : base;
    }
    case "scroll_depth": {
      const pct = num(p.pct);
      return pct === null ? "Rolou a página" : `Rolou até ${Math.round(pct)}% da página`;
    }
    case "slider_view": {
      const title = str(p.title);
      if (title) return `Viu a foto: ${clip(title)}`;
      const i = num(p.index);
      return i === null ? "Viu uma foto da galeria" : `Viu a foto ${Math.round(i) + 1} da galeria`;
    }
    case "cta_click": {
      const l = ctaLabel(p.label);
      return l ? `Clicou em ${quoted(l)}` : "Clicou em um botão";
    }
    case "form_view":
      return "Viu o formulário";
    case "form_start":
      return "Começou a preencher o formulário";
    case "form_field_complete": {
      const f = FIELD_LABELS[str(p.field)];
      return f ? `Preencheu o campo ${f}` : "Preencheu um campo do formulário";
    }
    case "form_abandon": {
      const f = FIELD_LABELS[str(p.last_field)];
      return f ? `Saiu sem enviar o formulário (parou no campo ${f})` : "Saiu sem enviar o formulário";
    }
    case "form_submit_attempt": {
      if (!Array.isArray(p.invalid)) return "Clicou em enviar o formulário";
      const missing = p.invalid.map((f) => FIELD_LABELS[str(f)]).filter(Boolean);
      return missing.length ? `Clicou em enviar, mas faltou ${missing.join(" e ")}` : "Clicou em enviar, mas faltou preencher algum campo";
    }
    case "lead_submitted": {
      const intent = INTENT_LABELS[str(p.intent)];
      return intent ? `Enviou o formulário (${intent})` : "Enviou o formulário";
    }
    case "thank_you_view":
      return "Chegou na página de obrigado";
    case "whatsapp_click": {
      if (event.name === "thank_you_auto_redirect") return "Foi levado ao WhatsApp automaticamente";
      if (event.name === "direct") {
        const from = DIRECT_SOURCES[str(p.source)];
        const code = /^[0-9A-F]{6}$/.test(str(p.code) || "") ? `, código ${p.code}` : "";
        return `Abriu o WhatsApp direto${from ? ` (${from})` : ""}${code}`;
      }
      const l = ctaLabel(p.label);
      return l ? `Clicou para ir ao WhatsApp (${l})` : "Clicou para ir ao WhatsApp";
    }
    case "rage_click": {
      const l = ctaLabel(p.label);
      return l ? `Clicou repetidas vezes (frustração) em ${quoted(l)}` : "Clicou repetidas vezes no mesmo lugar (frustração)";
    }
    case "consent":
      if (p.granted === true) return "Aceitou os cookies";
      return p.granted === false ? "Recusou os cookies" : "Respondeu ao aviso de cookies";
    default:
      return FALLBACK;
  }
}

// Icon family for the timeline (the page maps each kind to an icon).
export function eventKind(event) {
  const type = event && event.type;
  if (type === "video") {
    if (event.name === "play") return "video_play";
    if (event.name === "pause") return "video_pause";
    if (event.name === "unmute") return "video_sound";
    if (event.name === "progress") return "video_progress";
    return "video_other";
  }
  const known = ["page_view", "faq_open", "section_view", "scroll_depth", "slider_view", "cta_click", "form_view", "form_start",
    "form_field_complete", "form_abandon", "form_submit_attempt", "lead_submitted", "thank_you_view", "whatsapp_click",
    "rage_click", "consent"];
  return known.includes(type) ? type : "other";
}

export function isMilestone(event) {
  return Boolean(event && MILESTONES.has(event.type));
}
