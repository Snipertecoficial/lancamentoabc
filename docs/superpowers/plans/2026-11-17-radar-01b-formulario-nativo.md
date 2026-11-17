# Radar — Plano 1b: Formulário nativo (sai o RD Station)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. UI task loads `frontend-design:frontend-design`.

**Goal:** Trocar os formulários do RD Station (embutido e pop-up) por um formulário nosso, que grava o lead direto no Supabase, confirma no servidor antes de ir para a /obrigado e mantém a conversão do Google Ads funcionando.

**Decisão do dono (2026-11-17):** "substituir por formulários nativos do nosso sistema e tirar RD". Consequência aceita: leads deixam de entrar no RD Station (e as automações de lá param). Os leads ficam no painel; o lead continua indo para o WhatsApp dos corretores.

**Spec:** `docs/superpowers/specs/2026-11-16-painel-tracking-design.md` + esta decisão. Plano 1: `2026-11-16-radar-01-fundacao-coleta.md`.

## Global Constraints
- Branch `radar`; nada no `master` sem ok. Commits só nos próprios caminhos.
- Campos: **Nome** (obrigatório, 2–80 caracteres) e **WhatsApp** (obrigatório, máscara `(11) 99999-9999`, válido = E.164 brasileiro via `normalizePhoneBR`). E-mail **opcional** (oculto atrás de "adicionar e-mail"? → não: campo opcional visível, validado se preenchido). Intenção opcional: "Morar" / "Investir" (radio).
- Texto LGPD abaixo do botão: "Ao enviar, você concorda em ser contatado pela Espontone sobre este lançamento, conforme nossa Política de Privacidade." (link `/privacidade`, página criada no Plano 3; até lá aponta para `#`).
- Anti-bot: campo honeypot oculto + tempo mínimo de 2 s entre abrir e enviar + limite no servidor (máx. 5 envios por IP-hash por hora).
- O `<form>` usa `id="conversion-form-espontone"` (mesmo id do RD) para os gatilhos atuais do GTM continuarem disparando até o GTM migrar para `generate_lead` (Plano 3).
- Fluxo: enviar → `POST /functions/v1/submit-lead` (text/plain JSON) → resposta `{ok:true, lead_token}` → guarda token (`sessionStorage.radar_lead_token`) → `navigate("/obrigado")`. Erro → mensagem amigável e botão "Falar no WhatsApp" como alternativa (o lead nunca fica sem saída).
- Remover: script de loader do RD (`public/index.html`), `rdstation-forms` (`LeadFormCard.jsx`), `redirect_to`. Manter GTM e o resto da LP iguais.
- Os botões que hoje rolam até o formulário (`openWhatsApp`) continuam rolando até o novo formulário (`#rd-form-section` vira `#form-lead`; manter alias para não quebrar âncoras).

## Review Focus
1. Envio duplo (clique duplo, Enter + clique) → um lead, um token, uma navegação.
2. Servidor fora/lento → usuário vê erro claro com opção de WhatsApp em ≤ 8 s; nada trava.
3. Telefone digitado de várias formas → mesmo lead (dedup do `record_lead`).
4. Bot (honeypot preenchido ou envio < 2 s) → servidor responde `ok` falso-positivo (204) sem gravar, sem revelar o filtro.
5. GTM continua vendo o submit do form com o id antigo.

---

### Task 1: Edge Function `submit-lead`
**Files:** `supabase/functions/submit-lead/{index,handler,handler_test}.ts`; reutilizar `_shared` (phone, hash, cors, config, uuid, db).
**Interface:** `POST` text/plain `{env, session_id, visitor_id|null, name, phone, email?, intent?, form_id, hp (honeypot), elapsed_ms}` → `200 {ok:true, lead_token}` | `400 {ok:false, error:"invalid_name"|"invalid_phone"|"invalid_email"}` | `429 {ok:false, error:"rate_limited"}` | bot → `200 {ok:true, lead_token:<uuid falso>}` sem gravar. Grava via `rpc('record_lead', …)` com token novo e registra evento `lead_submitted` (props `{form_id, intent}` — sem PII) na sessão. Rate limit: conta `lead_submitted` da mesma `ip_hash` na última hora (via `sessions.ip_hash`), > 5 → 429. CORS = mesma allowlist padrão. Deploy `verify_jwt=false`.
- [ ] Testes (deps falsos): válido → recordLead com E.164 e 200 com token; nome curto/telefone inválido/e-mail inválido → 400 com código; honeypot/elapsed < 2000 → 200 sem gravar; rate limit → 429; dep lança → 500 `{ok:false}` com CORS.
- [ ] RED → GREEN → commit → deploy → curl ao vivo (válido, inválido, bot) → limpar dados criados.

### Task 2: Formulário nativo na LP (e remoção do RD)
**Files:** Create `frontend/src/components/LeadForm.jsx`, `frontend/src/lib/radar/submitLead.js` (`submitLead(fields): Promise<{ok:true, token}|{ok:false, error}>`, timeout 8 s), testes. Modify `LeadFormCard.jsx` (usa `LeadForm`), `public/index.html` (remove loader RD), `frontend/src/lib/whatsapp.js` (âncora), `collectors/forms.js` (passa a reconhecer o form nativo: `input[name="phone"]` além dos nomes do RD).
- Visual integrado à LP (navy/azul, mesmo card), estados: normal, enviando (botão desabilitado com spinner), erro (mensagem + botão WhatsApp), sucesso → navega.
- Máscara de telefone sem dependência nova.
- [ ] Testes: validação no cliente; submit único com clique duplo; sucesso grava token e navega para `/obrigado`; erro mostra WhatsApp; honeypot e `elapsed_ms` enviados; GTM vê `submit` no form `#conversion-form-espontone`; coletor `forms` emite `form_start`/`form_field_complete` no form nativo.
- [ ] RED → GREEN (`CI=true npx craco test --watchAll=false`) → `npm run build` ok → commit.

### Task 3: Revalidação ponta a ponta
- [ ] Localhost: jornada com UTM/gclid → formulário nativo → /obrigado → WhatsApp; conferir no banco lead, origem, eventos ligados ao lead (inclusive os da /obrigado), `generate_lead` com `user_data` no dataLayer.
