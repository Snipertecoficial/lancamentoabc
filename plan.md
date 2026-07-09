# plan.md — Landing Page “Landscape (Paddan) + Espontone”

## 1) Objectives
- Entregar uma **LP premium e altamente conversiva** (mobile-first) para o empreendimento **Landscape** com branding provisório **ESPONTONE**.
- Implementar **core de conversão via WhatsApp** (sem número por enquanto): formulário (hero + final) e CTAs abrindo WhatsApp Web/wa.me com mensagem pré-preenchida.
- Montar as **12 seções do Blueprint** usando a **copy pronta** + assets públicos como placeholders.
- Aplicar **efeitos visuais com performance**: parallax/reveal (desktop) + mock iPhone com vídeo YouTube.
- Preparar entrega em **.zip** para upload manual no GitHub.

## 2) Implementation Steps (Phased)

### Phase 1 — Core Flow POC (isolated) ✅
**Goal:** garantir que o fluxo principal (captura → WhatsApp) e os 2 efeitos-chave funcionem antes de construir tudo.

**POC scope (single page sandbox):**
1. **WhatsApp CTA builder**
   - Função utilitária `buildWhatsAppUrl(message)` que abre WhatsApp Web com texto prefill.
   - Sem número: usar fallback `https://wa.me/?text=...` e/ou `https://api.whatsapp.com/send?text=...`.
   - Validar encoding pt-BR e inclusão de dados do form.
2. **Hero minimal**
   - H1 + subtítulo + 4 ícones + formulário (Nome/WhatsApp/Morar|Investir) → botão abre WhatsApp.
3. **Mock iPhone com YouTube**
   - Implementar componente CSS (do Doc 05) responsivo; testar desktop/mobile.
4. **Parallax/reveal performance gate**
   - Implementar parallax leve (desktop) + `prefers-reduced-motion` + disable mobile.

**POC user stories (min 5):**
1. Como usuário, quero enviar meus dados do formulário para o WhatsApp com 1 clique.
2. Como usuário, quero ver o H1 e o formulário em até 3s na primeira dobra.
3. Como usuário, quero assistir ao tour dentro de um mock de iPhone no desktop.
4. Como usuário mobile, quero ver o mock adaptado sem travamentos.
5. Como usuário sensível a animações, quero que efeitos reduzam automaticamente com `prefers-reduced-motion`.

**Exit criteria:**
- Links abrem WhatsApp corretamente com mensagem completa.
- Mock iPhone responsivo ok.
- Animações não degradam a navegação (mobile sem parallax pesado).

---

### Phase 2 — V1 App Development (full LP) 🏗️
**Stack:** React + Tailwind + Framer Motion.

**Build:**
1. **App shell + design system leve**
   - Paleta provisória: gold `#C8A45D`, navy `#0F2540`, off-white `#F5F2ED`.
   - Componentes base: `Section`, `Container`, `Button`, `CTAWhatsApp`, `Input`, `RadioGroup`, `Accordion`.
2. **Implementar seções 0–12 (Blueprint)**
   - 0 Header sticky + menu âncoras + CTA.
   - 1 Hero com imagem fachada placeholder + form.
   - 2 Vídeo mock iPhone (YouTube embed).
   - 3 Conceito + imagem `landscape_cidade.webp`.
   - 4 Galeria Lazer: categorias + grid/scroll-snap + reveal 3D.
   - 5 Plantas: 5 cards com CTA WhatsApp por tipologia.
   - 6 Obra: barras de progresso + galeria 10 fotos + link vídeo obra.
   - 7 Localização: Google Maps embed + lista POIs.
   - 8 Por que comprar na planta: texto do Doc SEO.
   - 9 Quem somos: copy Espontone (com placeholders de números).
   - 10 Depoimentos: 3 cards placeholder.
   - 11 Form final + FAQ (com JSON-LD FAQPage).
   - 12 Rodapé: contatos placeholders + CRECI placeholder.
3. **Elementos fixos**
   - Botão WhatsApp flutuante.
   - Scroll progress bar (opcional; implementar só se não afetar LCP).
4. **SEO on-page básico**
   - Title/description, OG tags, headings corretos, alt text.
   - Schema: `FAQPage` + `RealEstateListing` (mínimo) se aplicável.
5. **Performance**
   - Lazy-load imagens abaixo da dobra.
   - Reduzir motion no mobile + `prefers-reduced-motion`.

**V1 user stories (min 5):**
1. Como usuário, quero navegar pelas seções via menu sticky com scroll suave.
2. Como usuário, quero ver galeria de lazer com rolagem fluida e legendas claras.
3. Como usuário, quero clicar numa planta e abrir WhatsApp com a tipologia já preenchida.
4. Como usuário, quero ver o andamento da obra e fotos reais para confiar na entrega.
5. Como usuário, quero localizar o empreendimento no mapa e entender o entorno rapidamente.

**End of phase:** rodar 1 ciclo de testes E2E (navegação, responsividade, CTAs, embeds).

---

### Phase 3 — Polish + Content/SEO upgrades + Accessibility ✨
1. **Refinar animações** (Framer Motion): reveal padronizado e suave; remover excesso.
2. **Aprimorar SEO/GEO**
   - Inserir blocos GEO do ABC (Linha 20-Rosa, BRT-ABC) conforme Doc 04.
   - Ajustar FAQ para rich results.
3. **Acessibilidade**
   - Contraste, foco visível, labels/aria, navegação por teclado.
4. **Assets reais (quando enviados)**
   - Trocar logo-texto por logo.
   - Trocar vídeo YouTube por mp4 se houver.

**Polish user stories (min 5):**
1. Como usuário, quero que o site carregue rápido mesmo no 4G.
2. Como usuário, quero ler textos com contraste confortável.
3. Como usuário, quero interagir com FAQ pelo teclado.
4. Como investidor, quero entender rapidamente a tese de valorização da região.
5. Como usuário, quero ver identidade visual consistente com a marca (logo + cores finais).

**End of phase:** novo ciclo de testes E2E + Lighthouse pass.

---

### Phase 4 — Optional “WOW” Scroll 3D Frames (only if approved) 🎬
**Pre-req:** receber frames reais (ou gerar via Runway/Luma) + decisão de aplicar só em 1 seção.
1. Web research rápido: melhores práticas canvas sequence + lazy preloading + mobile fallback.
2. Implementar `canvas` scroll-driven (Doc 05) **desktop-only**, com fallback imagem estática no mobile.
3. Medir impacto em LCP/CLS e ajustar.

**WOW user stories (min 5):**
1. Como usuário desktop, quero ver a fachada com efeito cinematográfico ao rolar.
2. Como usuário, quero que o efeito não afete a leitura do conteúdo.
3. Como usuário mobile, quero ver versão leve (sem sequência pesada).
4. Como usuário, quero que o efeito respeite `prefers-reduced-motion`.
5. Como usuário, quero perceber “premium” sem perder performance.

## 3) Next Actions
- Implementar **Phase 1 POC** (WhatsApp prefill + hero + mock iPhone + parallax gate).
- Após POC OK, construir **Phase 2 V1** com todas as seções e placeholders.
- Empacotar entrega em **.zip** (incluindo README com instruções de build/deploy).

## 4) Success Criteria
- **Conversão:** todos CTAs e formulários abrem WhatsApp com mensagem correta (sem número por enquanto).
- **UX:** hero acima da dobra claro e com formulário funcional; navegação por âncoras funcionando.
- **Responsivo:** layout impecável em mobile (galeria em carrossel/scroll-snap; mock iPhone adaptado).
- **Performance:** lazy-load + motion reduzido no mobile; sem jank perceptível.
- **Conteúdo:** copy aplicada integralmente + SEO básico + FAQ schema válido.
- **Entrega:** projeto pronto em **.zip** para upload manual no GitHub.