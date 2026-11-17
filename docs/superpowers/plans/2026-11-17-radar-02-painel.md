# Radar — Plano 2: Painel em /login

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. UI tasks also load `frontend-design:frontend-design` before writing components. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dentro da própria LP (`https://lancamento.espontone.com.br/login`), um painel só para o admin que mostra cada lead e cada passo dele: nome, WhatsApp, e-mail, de onde veio (anúncio ou orgânico, campanha, palavra-chave), o que fez na página e a que horas.

**Architecture:** Views SQL `security_invoker` sobre as tabelas do Plano 1 (RLS admin-only já existente) + app React carregado sob demanda (lazy) nas rotas `/login` e `/painel/*` da LP, usando `@supabase/supabase-js` com a chave publicável e Supabase Auth. Nada do painel entra no bundle inicial da LP e o Radar não rastreia as rotas do painel.

**Tech Stack:** React 19 (CRA/craco) · React Router 7 · Tailwind + shadcn (`src/components/ui`) · @tanstack/react-query (já instalado) · Recharts (já instalado) · @supabase/supabase-js@2 (novo) · Postgres views + pgTAP runner (padrão `supabase/tests/01_schema.test.sql`).

**Spec:** `docs/superpowers/specs/2026-11-16-painel-tracking-design.md` §7.5 — com a decisão do dono (2026-11-17): o painel fica **dentro da LP** em `/login`, não em app separado; acesso só do admin `douglas@snipertec.com.br`; leads de anúncios são a prioridade, orgânicos também aparecem.

## Global Constraints

- Branch `radar`; nunca push no `master` sem ok explícito (push no master publica no site do cliente).
- Supabase `cnsmmwbqfbaimwexmtkx`. URL `https://cnsmmwbqfbaimwexmtkx.supabase.co`, chave publicável `sb_publishable_VE2bpVqSFZHiX89hBIaLOg_Z1A-PYLh` (pública por design; segurança = RLS). Env: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_PUBLISHABLE_KEY` em `frontend/.env.production` e `.env.development`.
- Acesso: só usuário autenticado com `public.is_admin() = true`. Qualquer outro → sai e vê "Acesso não autorizado".
- Todo o código do painel em `frontend/src/painel/`, carregado com `React.lazy`; `@supabase/supabase-js` não pode aparecer no chunk principal (verificar no build).
- Radar não rastreia `/login` nem `/painel*` (o `track` descarta eventos quando `location.pathname` começa com esses prefixos).
- Páginas do painel com `<meta name="robots" content="noindex, nofollow">`.
- Datas e horas sempre em `America/Sao_Paulo`, formato pt-BR (`16/11/2026 21:04`).
- Ambiente padrão nos filtros: `production`; alternável para `staging`.
- Visual: mesma identidade da LP (navy `#061224/#0A1930/#12294A`, azul `#3A70A3/#5B95CE/#7DB4E8`, Playfair Display para títulos, Inter para texto), denso e legível, responsivo (funciona no celular).
- Nenhum dado de lead em `localStorage`/logs do navegador.

## Review Focus

1. **Usuário logado que não é admin** → não vê nenhum dado e é deslogado (Tasks 1 e 2).
2. **Lead sem consentimento de cookies** (sem `visitor_id`) → ainda mostra origem e jornada pela sessão (Task 1).
3. **Lead que voltou em outro dia / outro aparelho** → linha do tempo agrupa por visita e mostra todas (Tasks 1 e 4).
4. **Visitante da LP** → bundle inicial não cresce com o painel e nenhum evento do painel vai para o Radar (Task 2).
5. **Lista com muitos leads** → paginação/limite no servidor, sem baixar a tabela inteira (Task 3).

---

### Task 1: Views do painel (banco)

**Files:** Create `supabase/migrations/<versão remota>_radar_panel_views.sql`, `supabase/tests/03_panel_views.test.sql` (padrão runner com rollback). Aplicar via MCP `apply_migration` (nome `radar_panel_views`).

**Interfaces (produz), todas `with (security_invoker = true)`, `select` concedido só a `authenticated`, revogado de `anon`:**
- `panel_leads` — 1 linha por lead: `id, env, name, phone_e164, email, created_at, submitted_at, rd_confirmed_at, thank_you_at, whatsapp_at, stage` (`foi_whatsapp|chegou_obrigado|confirmado_rd|tentou`, o mais avançado preenchido), origem da **primeira sessão** do lead (`leads.first_session_id → sessions`): `utm_source, utm_medium, utm_campaign, utm_term, keyword, gclid, fbclid, device, landing_url, referrer`, `origin` (`google_ads` se gclid/gbraid/wbraid ou utm_medium em (`cpc`,`ppc`,`paid`) com utm_source google; `meta_ads` se fbclid ou utm_source em (`facebook`,`instagram`,`meta`) pago; `organic_search` se referrer de buscador; `direct` se sem referrer e sem utm; senão `other`), `visits` (sessões distintas com eventos do lead), `events_count`, `last_event_at`, `video_max_pct`, `faq_questions text[]` (distintas, ordem de abertura), `temperature` (`quente|morno|frio`: +2 vídeo ≥ 50%, +2 FAQ com "valor|preço|parcela|financ|entrada" no texto, +1 visits ≥ 2, +1 origem paga, +1 chegou_obrigado; ≥4 quente, 2–3 morno, senão frio).
- `panel_lead_events` — eventos com `lead_id` não nulo + dados da sessão: `lead_id, occurred_at, session_id, session_started_at, device, type, name, section, props`.
- `panel_sessions_live` — sessões com `last_event_at > now() - interval '5 minutes'` e `is_bot = false`: `id, env, started_at, last_event_at, landing_url, utm_source, utm_campaign, keyword, device, lead_id (via visitor), current_section (section do último section_view)`.
- `panel_funnel_daily` — por `day (America/Sao_Paulo)`, `env`, `origin`: `visits, watched_video, reached_form (form_view), started_form, submitted (lead_submitted), thank_you, whatsapp`.
- `panel_campaigns` — por `env, origin, utm_campaign, keyword`: `visits, leads, conversion_pct`.

- [ ] **Step 1:** Escrever `03_panel_views.test.sql` (runner com rollback): admin (claims do uid admin) vê 1 lead semeado em `panel_leads`; usuário autenticado não admin vê 0; `anon` sem permissão; `stage` e `temperature` corretos para lead semeado (vídeo 75%, FAQ "Qual o valor…", gclid → `quente`, `google_ads`); lead sem visitor ainda tem `utm_campaign` vindo da sessão; lead com 2 sessões → `visits = 2` e eventos das duas em `panel_lead_events`; `panel_sessions_live` exclui sessão de 10 min atrás e bots.
- [ ] **Step 2:** Rodar via `execute_sql` → RED.
- [ ] **Step 3:** Migration com as 5 views; aplicar; ajustar nome local à versão remota.
- [ ] **Step 4:** Rodar 03 + reexecutar 01 e 02 → GREEN; `get_advisors` security sem itens novos.
- [ ] **Step 5:** Commit.

---

### Task 2: Base do painel no front (rotas, login, guarda, isolamento)

**Files:** Create `frontend/src/painel/{supabase.js, auth.js, PainelApp.jsx, LoginPage.jsx, RequireAdmin.jsx, Layout.jsx}`, `frontend/src/painel/__tests__/*`. Modify `frontend/src/App.js` (rotas lazy `/login`, `/painel/*`), `frontend/src/lib/radar/index.js` (descartar eventos em rotas do painel), `frontend/.env.production`, `frontend/.env.development`, `frontend/.env.example`, `frontend/package.json` (`@supabase/supabase-js@2`).

**Interfaces:**
- `supabase.js`: `export const supabase = createClient(URL, KEY, { auth: { persistSession: true, storageKey: "radar-painel-auth" } })`.
- `auth.js`: `signIn(email, password): Promise<{ok: true} | {ok: false, error: string}>` (mensagens pt-BR: credenciais inválidas, sem acesso); `signOut()`; `useAdminSession(): {status: "loading"|"anon"|"denied"|"admin", user}` — chama `supabase.rpc("is_admin")`; `denied` faz `signOut`.
- `RequireAdmin`: `loading` → skeleton; `anon` → redireciona `/login`; `denied` → tela "Acesso não autorizado"; `admin` → filhos.
- `/login`: formulário e-mail/senha (sem cadastro, sem "esqueci senha" por ora), após login → `/painel`. Se já admin → vai direto.
- `Layout`: barra lateral (Leads, Funil & Campanhas, Ao vivo) recolhível no mobile, topo com seletor de ambiente (`production` padrão / `staging`) guardado em contexto, botão Sair.
- Radar: `track` ignora quando `location.pathname` começa com `/login` ou `/painel`; `initRadar` não inicia coletores nessas rotas.
- `noindex` aplicado ao entrar nas rotas do painel.

- [ ] **Step 1:** Testes: `RequireAdmin` para os 4 estados (mock de `auth`); `signIn` traduz erros; Radar: `track` em `/painel/x` não enfileira; em `/` enfileira.
- [ ] **Step 2:** RED → implementar → GREEN (`CI=true npx craco test --watchAll=false`).
- [ ] **Step 3:** `npm run build`: confirmar que o chunk principal (`main.*.js`) não contém `supabase-js` (`grep -L "GoTrueClient" build/static/js/main.*.js`) e que existe chunk separado com ele; reportar tamanho do main antes/depois (crescimento ≤ 2 KB gzip).
- [ ] **Step 4:** Commit.

---

### Task 3: Tela de Leads (lista + indicadores)

**Files:** Create `frontend/src/painel/pages/LeadsPage.jsx`, `frontend/src/painel/lib/{format.js, origin.js, csv.js}`, testes.

**Interfaces:**
- Consome `panel_leads` via react-query, `range()` paginado (50 por página), filtros no servidor: período (`hoje`, `7 dias`, `30 dias`, personalizado — sobre `created_at`), `origin`, `stage`, `env`, busca por nome/telefone/e-mail (`ilike`/`or`).
- Indicadores no topo (mesmo filtro de período/ambiente): Leads no período, Leads de anúncios, Chegaram ao WhatsApp, Taxa visita→lead (via `panel_funnel_daily`).
- Colunas: Nome · WhatsApp (formatado `(11) 94038-3680`, botão abre `wa.me`) · Origem (badge Google Ads/Meta Ads/Orgânico/Direto + campanha e palavra-chave) · Estágio (chips com hora) · Temperatura · Chegou em · Última atividade. Linha clicável → `/painel/leads/:id`.
- `format.js`: `formatPhoneBR(e164)`, `formatDateTimeBR(iso)` (America/Sao_Paulo), `relativeTimeBR(iso)`; `origin.js`: rótulos/cores por `origin`; `csv.js`: `toCSV(rows)` com BOM UTF-8 e `;` (abre certo no Excel BR).

- [ ] **Step 1:** Testes de `format`, `origin`, `csv` e da página com dados mockados (filtro muda a query; clique navega).
- [ ] **Step 2:** RED → implementar (carregar `frontend-design:frontend-design` antes do JSX) → GREEN.
- [ ] **Step 3:** Commit.

---

### Task 4: Linha do tempo do lead

**Files:** Create `frontend/src/painel/pages/LeadPage.jsx`, `frontend/src/painel/lib/eventLabels.js`, testes.

**Interfaces:**
- Consome `panel_leads` (1 linha) e `panel_lead_events` (`lead_id = :id`, ordenado).
- Cabeçalho: nome, WhatsApp (abre conversa), e-mail, temperatura, os 4 marcos com data/hora (Enviou formulário → Confirmado → Página de obrigado → Foi ao WhatsApp).
- Card de origem: anúncio/orgânico, campanha, palavra-chave, gclid (copiável), dispositivo, página de entrada, referrer.
- Linha do tempo agrupada por visita ("Visita 1 — 16/11 21:02, celular, 6 min"), cada evento com hora e frase em português via `eventLabels.js`: `labelFor(event): string` — ex.: `page_view` "Entrou na página", `video/play` "Deu play no vídeo", `video/progress {pct:50}` "Assistiu 50% do vídeo", `video/unmute` "Ativou o som do vídeo", `faq_open {question}` "Abriu a dúvida: …", `cta_click {label}` "Clicou em …" (mapa de `data-testid` conhecidos → texto humano, ex. `hero-cta-visit` "Agendar visita"), `section_view {seconds}` "Viu a seção Dúvidas por 42 s", `scroll_depth {pct}` "Rolou 75% da página", `slider_view {title}` "Viu a foto: Piscina…", `form_start` "Começou a preencher o formulário", `form_field_complete {field}` "Preencheu o campo Celular", `form_abandon` "Saiu sem enviar o formulário", `form_submit_attempt`/`lead_submitted` "Enviou o formulário", `thank_you_view` "Chegou na página de obrigado", `whatsapp_click` "Clicou para ir ao WhatsApp", `rage_click` "Clicou repetidas vezes (frustração) em …", `consent {granted}` "Aceitou/Recusou cookies".
- Resumo no topo da linha do tempo: tempo total na página, % máx. do vídeo, dúvidas abertas, nº de visitas.

- [ ] **Step 1:** Testes de `labelFor` (todos os tipos) e da página (agrupamento por visita, marcos).
- [ ] **Step 2:** RED → implementar (com `frontend-design:frontend-design`) → GREEN.
- [ ] **Step 3:** Commit.

---

### Task 5: Funil & Campanhas + Ao vivo

**Files:** Create `frontend/src/painel/pages/{FunilPage.jsx, AoVivoPage.jsx}`, testes.

**Interfaces:**
- Funil: barras horizontais (Recharts) de `panel_funnel_daily` somado no período/ambiente/origem, com % de perda entre etapas; tabela `panel_campaigns` ordenada por leads; gráfico de leads por dia.
- Ao vivo: `panel_sessions_live` com polling a cada 10 s (react-query `refetchInterval`), cartões "agora no site": origem, campanha/palavra-chave, dispositivo, seção atual, há quanto tempo; se a sessão já é de um lead, link para a linha do tempo.

- [ ] **Step 1:** Testes com dados mockados (cálculo de perda, ordenação, polling configurado).
- [ ] **Step 2:** RED → implementar (com `frontend-design:frontend-design`) → GREEN.
- [ ] **Step 3:** Commit.

---

### Task 6: Verificação ponta a ponta do painel

- [ ] **Step 1:** `npm start` local; logar com o admin (o dono digita a senha); navegar Leads → lead de teste → Funil → Ao vivo; screenshots desktop e mobile.
- [ ] **Step 2:** Usuário não admin (criar e apagar um usuário de teste sem senha conhecida? → não: testar com a guarda via teste unitário + sessão anônima) e acesso direto a `/painel` sem login → redireciona `/login`.
- [ ] **Step 3:** Build de produção: chunk principal sem supabase-js; LP inicial com mesmo peso (±2 KB gzip).

**Pronto quando:** o admin entra em `/login`, vê os leads com origem e estágio, abre um lead e lê a jornada inteira em português com horários, e um visitante da LP não carrega nada do painel.
