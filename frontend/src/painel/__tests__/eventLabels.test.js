import { labelFor, eventKind, isMilestone, sectionLabel, ctaLabel } from "../lib/eventLabels";

const ev = (type, props = {}, extra = {}) => ({ type, props, name: null, section: null, ...extra });

describe("labelFor", () => {
  test.each([
    ["page_view on /", ev("page_view", { path: "/" }), "Entrou na página"],
    ["page_view without path", ev("page_view", {}), "Entrou na página"],
    ["page_view on another path drops the query", ev("page_view", { path: "/obrigado?x=1" }), "Entrou na página /obrigado"],
    ["video play", ev("video", { video: "hero" }, { name: "play" }), "Deu play no vídeo"],
    ["video pause", ev("video", { video: "hero" }, { name: "pause" }), "Pausou o vídeo"],
    ["video unmute", ev("video", { video: "hero" }, { name: "unmute" }), "Ativou o som do vídeo"],
    ["video progress", ev("video", { video: "hero", pct: 50 }, { name: "progress" }), "Assistiu até 50% do vídeo"],
    ["video progress without pct", ev("video", {}, { name: "progress" }), "Assistiu parte do vídeo"],
    ["video unknown name", ev("video", {}, { name: "seek" }), "Interagiu com o vídeo"],
    ["faq_open", ev("faq_open", { question: "Qual o valor da entrada?" }, { section: "faq" }), "Abriu a dúvida: Qual o valor da entrada?"],
    ["faq_open without question", ev("faq_open", {}), "Abriu uma dúvida"],
    ["section_view faq", ev("section_view", { seconds: 42 }, { section: "faq" }), "Viu a seção Dúvidas por 42 s"],
    ["section_view top, minutes", ev("section_view", { seconds: 75 }, { section: "top" }), "Viu a seção Topo/vídeo por 1 min 15 s"],
    ["section_view contato", ev("section_view", { seconds: 5 }, { section: "contato" }), "Viu a seção Formulário por 5 s"],
    ["section_view galeria3d", ev("section_view", { seconds: 8 }, { section: "galeria3d" }), "Viu a seção Galeria por 8 s"],
    ["section_view exact minutes", ev("section_view", { seconds: 120 }, { section: "faq" }), "Viu a seção Dúvidas por 2 min"],
    ["section_view without seconds", ev("section_view", {}, { section: "lazer" }), "Viu a seção Lazer"],
    ["section_view unknown id", ev("section_view", { seconds: 3 }, { section: "nova-secao" }), "Viu a seção “nova-secao” por 3 s"],
    ["section_view without section", ev("section_view", { seconds: 3 }), "Viu uma seção da página por 3 s"],
    ["scroll_depth", ev("scroll_depth", { pct: 75 }), "Rolou até 75% da página"],
    ["scroll_depth without pct", ev("scroll_depth", {}), "Rolou a página"],
    ["slider_view with title", ev("slider_view", { index: 2, title: "Piscina" }), "Viu a foto: Piscina"],
    ["slider_view without title", ev("slider_view", { index: 2 }), "Viu a foto 3 da galeria"],
    ["slider_view without anything", ev("slider_view", {}), "Viu uma foto da galeria"],
    ["cta_click known testid", ev("cta_click", { label: "hero-cta-visit", x: 1, y: 2 }), "Clicou em “Agendar visita”"],
    ["cta_click faq toggle", ev("cta_click", { label: "faq-toggle-0" }), "Clicou em “Dúvida 1”"],
    ["cta_click slider dot", ev("cta_click", { label: "slider3d-dot-4" }), "Clicou em “Foto 5 da galeria”"],
    ["cta_click free text", ev("cta_click", { label: "Ver plantas", href: "https://x.com/a" }), "Clicou em “Ver plantas”"],
    ["cta_click without label", ev("cta_click", { x: 1, y: 1 }), "Clicou em um botão"],
    ["form_view", ev("form_view", {}), "Viu o formulário"],
    ["form_start", ev("form_start", { form_id: "form-lead" }), "Começou a preencher o formulário"],
    ["form_field_complete name", ev("form_field_complete", { field: "name" }), "Preencheu o campo Nome"],
    ["form_field_complete phone", ev("form_field_complete", { field: "phone" }), "Preencheu o campo Celular"],
    ["form_field_complete mobile_phone", ev("form_field_complete", { field: "mobile_phone" }), "Preencheu o campo Celular"],
    ["form_field_complete email", ev("form_field_complete", { field: "email" }), "Preencheu o campo E-mail"],
    ["form_field_complete unknown", ev("form_field_complete", { field: "cpf" }), "Preencheu um campo do formulário"],
    ["form_abandon with last field", ev("form_abandon", { last_field: "email" }), "Saiu sem enviar o formulário (parou no campo E-mail)"],
    ["form_abandon without field", ev("form_abandon", {}), "Saiu sem enviar o formulário"],
    ["form_submit_attempt", ev("form_submit_attempt", { form_id: "form-lead" }), "Clicou em enviar o formulário"],
    ["lead_submitted", ev("lead_submitted", { form_id: "form-lead", lead_token: "tok-secret", ip_hash: "hash-secret" }), "Enviou o formulário"],
    ["lead_submitted with intent", ev("lead_submitted", { intent: "morar", lead_token: "tok-secret" }), "Enviou o formulário (quer morar)"],
    ["lead_submitted with intent investir", ev("lead_submitted", { intent: "investir" }), "Enviou o formulário (quer investir)"],
    ["thank_you_view", ev("thank_you_view", {}), "Chegou na página de obrigado"],
    ["whatsapp_click", ev("whatsapp_click", { lead_token: "tok-secret" }, { name: "thank_you_page" }), "Clicou para ir ao WhatsApp"],
    ["whatsapp_click auto redirect", ev("whatsapp_click", { lead_token: "tok-secret" }, { name: "thank_you_auto_redirect" }), "Foi levado ao WhatsApp automaticamente"],
    ["whatsapp_click with known label", ev("whatsapp_click", { label: "footer-whatsapp", href: "https://wa.me/55" }), "Clicou para ir ao WhatsApp (WhatsApp do rodapé)"],
    ["rage_click", ev("rage_click", { label: "hero-cta-unit", x: 1, y: 1 }), "Clicou repetidas vezes (frustração) em “Garanta sua unidade”"],
    ["rage_click without label", ev("rage_click", { label: "" }), "Clicou repetidas vezes no mesmo lugar (frustração)"],
    ["consent granted", ev("consent", { granted: true }), "Aceitou os cookies"],
    ["consent refused", ev("consent", { granted: false }), "Recusou os cookies"],
    ["unknown type", ev("mystery_event", { a: 1 }), "Outra interação na página"],
  ])("%s", (_, event, expected) => {
    expect(labelFor(event)).toBe(expected);
  });

  test("never outputs lead_token, ip_hash or raw JSON", () => {
    const secret = { lead_token: "tok-secret", ip_hash: "hash-secret", nested: { a: 1 } };
    const types = ["page_view", "video", "faq_open", "section_view", "scroll_depth", "slider_view", "cta_click", "form_view",
      "form_start", "form_field_complete", "form_abandon", "form_submit_attempt", "lead_submitted", "thank_you_view",
      "whatsapp_click", "rage_click", "consent", "whatever"];
    types.forEach((type) => {
      const out = labelFor({ type, name: null, section: null, props: secret });
      expect(out).not.toMatch(/tok-secret|hash-secret|[{}]/);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    });
  });

  test("tolerates null props and missing fields", () => {
    expect(labelFor({ type: "cta_click", props: null })).toBe("Clicou em um botão");
    expect(labelFor({ type: "video" })).toBe("Interagiu com o vídeo");
    expect(labelFor(null)).toBe("Outra interação na página");
  });

  test("long free-text labels are shortened", () => {
    const out = labelFor(ev("cta_click", { label: "x".repeat(200) }));
    expect(out.length).toBeLessThan(80);
    expect(out).toContain("…");
  });
});

test("sectionLabel and ctaLabel cover the known ids", () => {
  expect(sectionLabel("top")).toBe("Topo/vídeo");
  expect(sectionLabel("faq")).toBe("Dúvidas");
  expect(sectionLabel("contato")).toBe("Formulário");
  expect(sectionLabel("galeria3d")).toBe("Galeria");
  expect(ctaLabel("hero-cta-whatsapp")).toBe("Quero condições exclusivas");
  expect(ctaLabel("hero-cta-unit")).toBe("Garanta sua unidade");
  expect(ctaLabel("hero-cta-talk")).toBe("Falar com corretor");
  expect(ctaLabel("header-cta-whatsapp")).toBe("Fale com corretor (topo)");
  expect(ctaLabel("hero-video-mute-toggle")).toBe("Som do vídeo");
  expect(ctaLabel("hero-video-play-toggle")).toBe("Play/pause do vídeo");
  expect(ctaLabel("footer-whatsapp")).toBe("WhatsApp do rodapé");
});

test("eventKind and isMilestone", () => {
  expect(eventKind(ev("video", {}, { name: "play" }))).toBe("video_play");
  expect(eventKind(ev("video", {}, { name: "unmute" }))).toBe("video_sound");
  expect(eventKind(ev("video", { pct: 50 }, { name: "progress" }))).toBe("video_progress");
  expect(eventKind(ev("lead_submitted"))).toBe("lead_submitted");
  expect(eventKind(ev("mystery"))).toBe("other");
  expect(isMilestone(ev("lead_submitted"))).toBe(true);
  expect(isMilestone(ev("thank_you_view"))).toBe(true);
  expect(isMilestone(ev("whatsapp_click"))).toBe(true);
  expect(isMilestone(ev("form_submit_attempt"))).toBe(false);
  expect(isMilestone(ev("cta_click"))).toBe(false);
});
