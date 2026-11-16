# Radar — Plano 1: Fundação + Coleta

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar no nosso Supabase a jornada completa de cada visitante da LP de testes e transformar quem envia nome + WhatsApp (em qualquer formulário RD) em lead confirmado por três fontes: navegador, webhook do RD e /obrigado.

**Architecture:** SDK próprio (`frontend/src/lib/radar/`) coleta eventos e envia em lote, como `text/plain` (sem preflight CORS), direto para a Edge Function `ingest` do Supabase. `confirm-lead` valida o `lead_token` na /obrigado e `rd-webhook` recebe a confirmação do RD. Funções SQL `security definer` concentram a lógica de lead (dedup, costura de identidade, marcos). Tudo roda na branch `radar` → Preview da Vercel; produção não é tocada.

**Tech Stack:** React 19 / CRA+craco / Jest (LP) · Supabase Postgres 17 + pgTAP · Edge Functions Deno + `@supabase/supabase-js@2` · Supabase CLI via `npx supabase@latest` · Docker (stack local).

**Spec:** `docs/superpowers/specs/2026-11-16-painel-tracking-design.md` (ler seções 4, 7.1–7.4 e 8 antes de começar).

## Global Constraints

- **Nunca dar push no `master`.** Ele publica na Vercel (produção) e por FTP na Hostgator (`.github/workflows/deploy.yml`). Todo trabalho na branch `radar`.
- Projeto Supabase: `espontone-radar`, região `sa-east-1`.
- O navegador nunca escreve em tabela: RLS ligado em todas as tabelas, nenhuma policy para `anon`; só as Edge Functions (service role) escrevem.
- Tracking nunca bloqueia o usuário: nenhum `preventDefault`, todo envio em `try/catch`, sem `await` no caminho do clique/submit.
- Nome/telefone/e-mail **nunca** são gravados em `events.props`; só na tabela `leads`.
- `env` ∈ `staging | production`, vindo de `REACT_APP_RADAR_ENV` (padrão `staging`).
- Sessão expira após 30 min sem evento. `visitor_id` persistente só com consentimento (`localStorage['lgpd-consent']` ∈ `granted|true`), cookie `rdr_vid`, `max-age=34128000` (395 dias).
- Lote: envia a cada 5 s ou ao chegar em 20 eventos, e no `pagehide`/`visibilitychange=hidden`.
- Limites do `ingest`: corpo ≤ 65536 bytes, ≤ 50 eventos por lote, `occurred_at` no máximo 24 h no futuro.
- Telefone: E.164 brasileiro (`+55` + DDD + 8 ou 9 dígitos).
- Tipos de evento (fechados): `page_view, scroll_depth, section_view, cta_click, whatsapp_click, rage_click, video, faq_open, slider_view, form_view, form_start, form_field_complete, form_abandon, form_submit_attempt, lead_submitted, thank_you_view, consent`.
- SDK ≤ 6 KB minificado + gzip.

## Review Focus

1. **Mesmo telefone em formatos diferentes** (`(11) 94038-3680`, `11940383680`, `+55 11 94038-3680`, `011940383680`) → um único lead. Testado nas Tasks 2 e 3.
2. **/obrigado aberta direto, recarregada ou em nova aba** → `generate_lead` dispara no máximo uma vez, e nunca sem token. Testado nas Tasks 2 e 9.
3. **Lixo no `ingest`** (JSON inválido, > 50 eventos, > 64 KB, tipo desconhecido, data no futuro) → 400 ou evento descartado, nunca 500. Testado na Task 3.
4. **Webhook do RD sem envio prévio no navegador** (pop-up, JS bloqueado) **ou repetido** → cria/confirma uma vez só. Testado nas Tasks 2 e 5.
5. **Endpoint fora do ar ou bloqueado** → formulário RD envia normalmente e a /obrigado redireciona ao WhatsApp. Testado nas Tasks 7 e 9.

---

## Estrutura de arquivos

```
Arquivos site/
  supabase/
    config.toml                                  (gerado pelo init)
    migrations/20261116000001_radar_schema.sql   tabelas, índices, RLS
    migrations/20261116000002_radar_functions.sql record_lead, confirm_rd_lead, consume_lead_token, mark_lead_whatsapp
    tests/01_schema.test.sql                     pgTAP: RLS, constraints
    tests/02_functions.test.sql                  pgTAP: dedup, costura, tokens, webhook
    functions/_shared/phone.ts | hash.ts | envelope.ts | bot.ts | cors.ts | db.ts
    functions/_shared/*_test.ts
    functions/ingest/index.ts + handler.ts + handler_test.ts
    functions/confirm-lead/index.ts + handler.ts + handler_test.ts
    functions/rd-webhook/index.ts + handler.ts + parse.ts + *_test.ts
  frontend/src/lib/radar/
    config.js ids.js consent.js attribution.js queue.js transport.js index.js
    collectors/page.js sections.js clicks.js video.js forms.js
    __tests__/*.test.js
  frontend/src/components/  (modificados: ThankYou, CookieConsent, FAQ, Slider3D, HeroSection)
  frontend/src/App.js       (modificado: initRadar)
  frontend/.env.example     (novo)
```

---

### Task 1: Branch, Supabase local e schema com RLS

**Files:**
- Create: `supabase/` (via `npx supabase@latest init`), `supabase/migrations/20261116000001_radar_schema.sql`, `supabase/tests/01_schema.test.sql`

**Interfaces:**
- Produces (tabelas, todas em `public`, todas com RLS ligado):
  - `visitors(id uuid pk, env text, first_seen_at timestamptz, last_seen_at timestamptz, first_touch jsonb, last_touch jsonb, lead_id uuid null → leads)`
  - `sessions(id uuid pk, visitor_id uuid null → visitors, env text, started_at, last_event_at, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, gbraid, wbraid, fbclid, keyword, matchtype, campaign_id, adgroup_id, device, screen, lang, user_agent, ip_hash text, is_bot bool default false)`
  - `events(id uuid pk, session_id uuid → sessions, visitor_id uuid null, lead_id uuid null, type text, name text, section text, props jsonb default '{}', occurred_at timestamptz, received_at timestamptz default now())` — índices em `occurred_at`, `visitor_id`, `lead_id`, `(session_id, occurred_at)`, `type`
  - `leads(id uuid pk default gen_random_uuid(), env text, phone_e164 text, phone_raw text, name text, email text, first_session_id uuid, first_visitor_id uuid, first_touch jsonb, last_touch jsonb, submitted_at, rd_confirmed_at, thank_you_at, whatsapp_at timestamptz, rd_lead_id text, created_at, updated_at)` — único `(env, phone_e164)`; único parcial `(env, lower(email)) where phone_e164 is null`
  - `lead_visitors(lead_id, visitor_id, pk(lead_id, visitor_id))`
  - `lead_tokens(token uuid pk, lead_id uuid → leads, session_id uuid, created_at, used_at timestamptz null)`
  - `rd_webhook_raw(id bigserial pk, received_at timestamptz default now(), payload jsonb, matched_lead_ids uuid[], error text)`
  - `profiles(user_id uuid pk → auth.users, role text check (role = 'admin'), created_at)`
  - `is_admin() returns boolean` (security definer, `exists(select 1 from profiles where user_id = auth.uid() and role='admin')`)
  - Policies: só `select` para `authenticated` com `is_admin()` em todas as tabelas; nenhuma policy de escrita; nada para `anon`.
  - Checks: `env in ('staging','production')`; `events.type` na lista fechada das Global Constraints.

- [ ] **Step 1: Criar a branch e o projeto local**

Run (em `Arquivos site/`): `git checkout -b radar && npx supabase@latest init && npx supabase@latest start`
Expected: stack local no ar (Studio em `http://127.0.0.1:54323`). Instalar Deno se faltar: `winget install DenoLand.Deno`.

- [ ] **Step 2: Escrever o teste pgTAP `01_schema.test.sql`**

```sql
select plan(6);
select ok((select bool_and(relrowsecurity) from pg_class where relname in
  ('visitors','sessions','events','leads','lead_visitors','lead_tokens','rd_webhook_raw','profiles')), 'RLS ligado em todas');
set local role anon;
select throws_ok($$insert into events(id,session_id,type,occurred_at) values (gen_random_uuid(),gen_random_uuid(),'page_view',now())$$, '42501', null, 'anon não insere events');
select is((select count(*) from leads)::int, 0, 'anon não lê leads');
reset role;
select throws_ok($$insert into sessions(id,env,started_at) values (gen_random_uuid(),'dev',now())$$, '23514', null, 'env inválido rejeitado');
select throws_ok($$insert into events(id,session_id,type,occurred_at) values (gen_random_uuid(),gen_random_uuid(),'hack',now())$$, '23514', null, 'tipo de evento fora da lista rejeitado');
select has_function('is_admin');
select * from finish();
```

- [ ] **Step 3: Rodar e ver falhar** — Run: `npx supabase@latest test db` · Expected: FAIL (tabelas não existem)
- [ ] **Step 4: Escrever a migration `20261116000001_radar_schema.sql`** conforme o bloco Interfaces.
- [ ] **Step 5: Aplicar e rodar** — Run: `npx supabase@latest db reset && npx supabase@latest test db` · Expected: `01_schema.test.sql .. ok`
- [ ] **Step 6: Commit** — `git add supabase && git commit -m "feat(radar): schema base com RLS"`

---

### Task 2: Funções SQL de lead (dedup, costura, marcos, tokens)

**Files:**
- Create: `supabase/migrations/20261116000002_radar_functions.sql`, `supabase/tests/02_functions.test.sql`

**Interfaces:**
- Consumes: tabelas da Task 1.
- Produces (todas `security definer`, `execute` revogado de `public/anon/authenticated`, concedido a `service_role`):
  - `record_lead(p_env text, p_phone_e164 text, p_phone_raw text, p_name text, p_email text, p_session_id uuid, p_visitor_id uuid, p_lead_token uuid) returns uuid` — acha lead por `(env, phone_e164)`, senão `(env, lower(email))`; cria ou atualiza (`coalesce` em nome/e-mail, `submitted_at = coalesce(submitted_at, now())`, `first_*` só na criação); grava `lead_visitors` e `visitors.lead_id` se houver visitor; costura `events.lead_id` (eventos sem lead da mesma sessão **ou** de qualquer visitor do lead); grava `lead_tokens` se `p_lead_token` não for nulo.
  - `confirm_rd_lead(p_phone_e164 text, p_email text, p_name text, p_rd_lead_id text) returns uuid` — acha o lead mais recente com aquele telefone (ou e-mail) em qualquer env; se não existir, cria em `production` com `submitted_at` nulo; seta `rd_confirmed_at = coalesce(rd_confirmed_at, now())` e `rd_lead_id`.
  - `consume_lead_token(p_token uuid) returns table(lead_id uuid, first_use boolean, phone_e164 text, email text)` — zero linhas se o token não existe; marca `used_at` e `leads.thank_you_at` só no primeiro uso.
  - `mark_lead_whatsapp(p_token uuid) returns void` — `whatsapp_at = coalesce(whatsapp_at, now())` do lead do token.

- [ ] **Step 1: Escrever `02_functions.test.sql`**

```sql
select plan(9);
-- sessão + 2 eventos anteriores ao lead
insert into sessions(id,env,started_at) values ('00000000-0000-0000-0000-0000000000a1','staging',now());
insert into visitors(id,env,first_seen_at,last_seen_at) values ('00000000-0000-0000-0000-0000000000b1','staging',now(),now());
insert into events(id,session_id,visitor_id,type,occurred_at) values
 (gen_random_uuid(),'00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','page_view',now()),
 (gen_random_uuid(),'00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','faq_open',now());
select isnt(record_lead('staging','+5511940383680','(11) 94038-3680','Teste',null,
  '00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1'), null, 'cria lead');
select is((select count(*) from events where lead_id is not null)::int, 2, 'costura eventos anteriores');
select is(record_lead('staging','+5511940383680','11940383680',null,'t@x.com',null,null,null),
  (select id from leads where phone_e164='+5511940383680'), 'mesmo telefone = mesmo lead');
select is((select count(*) from leads)::int, 1, 'sem duplicata');
select is((select first_use from consume_lead_token('00000000-0000-0000-0000-0000000000c1')), true, 'token: 1º uso');
select is((select first_use from consume_lead_token('00000000-0000-0000-0000-0000000000c1')), false, 'token: 2º uso não conta');
select is((select count(*) from consume_lead_token(gen_random_uuid()))::int, 0, 'token inexistente: nada');
select is(confirm_rd_lead('+5511999990000',null,'Popup',null), confirm_rd_lead('+5511999990000',null,'Popup',null), 'webhook repetido é idempotente');
select isnt((select rd_confirmed_at from leads where phone_e164='+5511999990000'), null, 'lead só do webhook confirmado');
select * from finish();
```

- [ ] **Step 2: Rodar e ver falhar** — `npx supabase@latest test db` · Expected: FAIL (`function record_lead does not exist`)
- [ ] **Step 3: Escrever a migration** com as 4 funções do bloco Interfaces.
- [ ] **Step 4: Rodar** — `npx supabase@latest db reset && npx supabase@latest test db` · Expected: os dois arquivos `ok`
- [ ] **Step 5: Commit** — `git commit -am "feat(radar): funções de lead, tokens e webhook"` (incluir os arquivos novos com `git add supabase`)

---

### Task 3: Módulos compartilhados + Edge Function `ingest`

**Files:**
- Create: `supabase/functions/_shared/{phone,hash,envelope,bot,cors,db}.ts` + `_shared/{phone,envelope,bot,cors}_test.ts`, `supabase/functions/ingest/{index,handler,handler_test}.ts`

**Interfaces:**
- Consumes: `record_lead`, `mark_lead_whatsapp` (Task 2).
- Produces:
  - `normalizePhoneBR(raw: string | null): string | null` — só dígitos; remove `00`/`0` iniciais; 10–11 dígitos → prefixa `55`; 12–13 começando com `55` → mantém; senão `null`. Retorna `"+" + dígitos`.
  - `sha256Hex(input: string): Promise<string>`
  - `type RadarEvent = { id: string; type: EventType; name?: string; section?: string; ts: string; props?: Record<string, unknown> }`
  - `type Batch = { v: 1; env: "staging" | "production"; session_id: string; visitor_id: string | null; session: SessionMeta; events: RadarEvent[] }` — `SessionMeta` = campos de `sessions` de `landing_url` a `lang` (Task 1).
  - `parseBatch(raw: string, now: Date): { ok: true; batch: Batch; dropped: number } | { ok: false; error: string }` — rejeita: > 65536 bytes, JSON inválido, `v !== 1`, `env` inválido, UUIDs inválidos, > 50 eventos. **Descarta** (conta em `dropped`) eventos de tipo desconhecido ou `ts` > 24 h no futuro.
  - `isBot(userAgent: string | null): boolean` — `/bot|crawl|spider|headless|lighthouse|preview|facebookexternalhit/i` ou UA vazio.
  - `isAllowedOrigin(origin: string | null, patterns: string[]): boolean` — padrões com `*` (ex.: `https://lancamentoabc-*.vercel.app`); `corsHeaders(origin, patterns): Headers`.
  - `handleIngest(req: Request, deps: IngestDeps): Promise<Response>` com `IngestDeps = { upsertSession(b: Batch, ipHash: string, isBot: boolean): Promise<void>; upsertVisitor(b: Batch): Promise<void>; insertEvents(b: Batch, events: RadarEvent[]): Promise<void>; recordLead(args: { env: string; phone_e164: string | null; phone_raw: string | null; name: string | null; email: string | null; session_id: string; visitor_id: string | null; lead_token: string }): Promise<string>; markWhatsapp(token: string): Promise<void>; allowedOrigins: string[]; ipSalt: string }`. Respostas: `OPTIONS` → 204 com CORS; erro de parse → 400 `{error}`; sucesso → 204. Qualquer exceção de `deps` → log + 204 (o cliente não tem o que fazer).
  - Regras do handler: em `lead_submitted`, chama `recordLead` com telefone normalizado e **remove** `name/phone/email` de `props` antes de `insertEvents` (fica `lead_token`, `form_id`); em `whatsapp_click` com `props.lead_token`, chama `markWhatsapp`. `ipHash = sha256Hex(ip + ipSalt + data UTC YYYY-MM-DD)`, IP de `x-forwarded-for` (primeiro item).
  - `index.ts` liga `handleIngest` a deps reais via `db.ts` (`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`; `upsert` com `onConflict` e `ignoreDuplicates` para eventos; `rpc('record_lead')`). Env: `RADAR_ALLOWED_ORIGINS` (vírgulas), `RADAR_IP_SALT`.

- [ ] **Step 1: Testes dos módulos compartilhados** (`deno test`)

```ts
// phone_test.ts
for (const raw of ["(11) 94038-3680", "11940383680", "+55 11 94038-3680", "011940383680", "5511940383680"])
  assertEquals(normalizePhoneBR(raw), "+5511940383680");
assertEquals(normalizePhoneBR("(11) 4038-3680"), "+551140383680");
assertEquals(normalizePhoneBR("123"), null);
assertEquals(normalizePhoneBR(null), null);
// envelope_test.ts
assertEquals(parseBatch("{", now).ok, false);
assertEquals(parseBatch("x".repeat(65537), now).ok, false);
assertEquals(parseBatch(batchWith(51), now).ok, false);
const r = parseBatch(batchWithTypes(["page_view", "hack"]), now); // ok, dropped 1
assertEquals([r.ok, r.ok && r.batch.events.length, r.ok && r.dropped], [true, 1, 1]);
const f = parseBatch(batchWithTs(addHours(now, 25)), now); // ok, mas evento do futuro descartado
assertEquals([f.ok, f.ok && f.dropped], [true, 1]);
// bot_test.ts
assertEquals(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
assertEquals(isBot(null), true);
assertEquals(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), false);
// cors_test.ts
assertEquals(isAllowedOrigin("https://lancamentoabc-git-radar-x.vercel.app", ["https://lancamentoabc-*.vercel.app"]), true);
assertEquals(isAllowedOrigin("https://evil.com", ["https://lancamentoabc-*.vercel.app"]), false);
```

- [ ] **Step 2: Rodar e ver falhar** — `deno test supabase/functions/_shared` · Expected: FAIL (módulos não existem)
- [ ] **Step 3: Implementar** os 6 módulos com as assinaturas acima.
- [ ] **Step 4: Rodar** — mesmo comando · Expected: PASS
- [ ] **Step 5: Testes do handler** (`ingest/handler_test.ts`, com `deps` falsos que registram chamadas)

```ts
// lote válido com lead_submitted → recordLead com "+5511940383680" e evento gravado sem PII
assertEquals(res.status, 204);
assertEquals(calls.recordLead[0].phone_e164, "+5511940383680");
assertEquals(Object.keys(calls.insertEvents[0][0].props).sort(), ["form_id", "lead_token"]);
// whatsapp_click com lead_token → markWhatsapp chamado
assertEquals(calls.markWhatsapp, ["<token>"]);
// corpo inválido → 400 e nada gravado
assertEquals((await handleIngest(post("{"), deps)).status, 400);
assertEquals(calls.insertEvents.length, 0);
// deps lançando erro → 204 (não 500)
assertEquals((await handleIngest(post(valid), throwingDeps)).status, 204);
// OPTIONS de origem permitida → 204 com Access-Control-Allow-Origin
```

- [ ] **Step 6: Rodar e ver falhar → implementar `handler.ts` e `index.ts` → rodar e ver passar** — `deno test supabase/functions/ingest --allow-env`
- [ ] **Step 7: Teste contra o banco local** — Run: `npx supabase@latest functions serve --no-verify-jwt` e `curl -X POST http://127.0.0.1:54321/functions/v1/ingest -H "Content-Type: text/plain" --data @supabase/functions/ingest/fixtures/batch.json` · Expected: `204`, e `select count(*) from events` > 0 no Studio. (Criar `fixtures/batch.json` com 3 eventos e 1 `lead_submitted`.)
- [ ] **Step 8: Commit** — `git add supabase/functions && git commit -m "feat(radar): edge function ingest"`

---

### Task 4: Edge Function `confirm-lead`

**Files:**
- Create: `supabase/functions/confirm-lead/{index,handler,handler_test}.ts`

**Interfaces:**
- Consumes: `consume_lead_token` (Task 2), `sha256Hex`, `corsHeaders` (Task 3).
- Produces: `POST /confirm-lead`, corpo `text/plain` `{"lead_token":"<uuid>"}` →
  - 200 `{"ok":true,"first_use":true,"user_data":{"sha256_phone_number":"<hex de +55…>","sha256_email_address":"<hex de email minúsculo sem espaços>"|null}}`
  - 200 `{"ok":true,"first_use":false,"user_data":null}` (token já usado)
  - 404 `{"ok":false}` (token inexistente) · 400 (corpo inválido) · OPTIONS 204 com CORS.
  - `handleConfirmLead(req: Request, deps: { consume(token: string): Promise<{first_use:boolean, phone_e164:string|null, email:string|null} | null>; allowedOrigins: string[] }): Promise<Response>`

- [ ] **Step 1: Testes** — primeiro uso → `first_use:true` e `user_data.sha256_phone_number === await sha256Hex("+5511940383680")`; e-mail `" T@X.com "` vira hash de `"t@x.com"`; segundo uso → `first_use:false, user_data:null`; token inexistente → 404; corpo inválido → 400.
- [ ] **Step 2: Rodar e ver falhar** — `deno test supabase/functions/confirm-lead --allow-env` · Expected: FAIL
- [ ] **Step 3: Implementar** `handler.ts` + `index.ts` (`rpc('consume_lead_token')`).
- [ ] **Step 4: Rodar e ver passar** · Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(radar): edge function confirm-lead"`

---

### Task 5: Edge Function `rd-webhook`

**Files:**
- Create: `supabase/functions/rd-webhook/{index,handler,parse,handler_test,parse_test}.ts`, `supabase/functions/rd-webhook/fixtures/rd_conversion.json`

**Interfaces:**
- Consumes: `confirm_rd_lead` (Task 2), `normalizePhoneBR` (Task 3).
- Produces:
  - `parseRdPayload(body: unknown): Array<{ name: string|null; email: string|null; phone_raw: string|null; rd_lead_id: string|null }>` — aceita `{ leads: [...] }`; telefone = `mobile_phone ?? personal_phone ?? null`; `rd_lead_id = String(id)` quando houver; corpo fora do formato → `[]`.
  - `POST /rd-webhook?secret=<RD_WEBHOOK_SECRET>` → segredo errado ou ausente: 401 (comparação em tempo constante); senão grava `rd_webhook_raw` **antes** de processar, chama `confirm_rd_lead` por lead (pula lead sem telefone e sem e-mail), atualiza `matched_lead_ids`/`error` e responde **200 sempre** (evita retry infinito do RD).
  - `handleRdWebhook(req, deps: { secret: string; storeRaw(payload): Promise<number>; confirm(lead): Promise<string>; finish(rawId: number, ids: string[], error: string|null): Promise<void> })`

- [ ] **Step 1: Testes** — fixture com 1 lead → `confirm` chamado com `phone_raw` normalizado; payload repetido → `confirm` chamado de novo (idempotência garantida no SQL, Task 2); `?secret=errado` → 401 e `storeRaw` não chamado; `{}` → 200, `confirm` não chamado; `confirm` lançando erro → 200 e `finish` com `error` preenchido.
- [ ] **Step 2: Rodar e ver falhar** — `deno test supabase/functions/rd-webhook --allow-env` · Expected: FAIL
- [ ] **Step 3: Implementar** `parse.ts`, `handler.ts`, `index.ts`.
- [ ] **Step 4: Rodar e ver passar** · Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(radar): webhook do RD Station"`

> A fixture segue o formato documentado do webhook de conversão do RD Station Marketing. O primeiro payload real (gravado em `rd_webhook_raw` na Task 11) é a referência final; se divergir, ajustar `parseRdPayload` e a fixture.

---

### Task 6: Projeto remoto (staging) e deploy

**Files:**
- Create: `supabase/.env.example` (só nomes das variáveis, sem valores)

**Interfaces:**
- Produces: URL base `https://<ref>.supabase.co/functions/v1` (vira `REACT_APP_RADAR_URL` na Task 10); secrets `RADAR_ALLOWED_ORIGINS`, `RADAR_IP_SALT`, `RD_WEBHOOK_SECRET`; usuário admin.

- [ ] **Step 1: Criar o projeto** `espontone-radar` em `sa-east-1` (painel do Supabase ou MCP do Supabase) — **pedir confirmação ao dono antes; plano gratuito por enquanto (spec §11.3).**
- [ ] **Step 2: Linkar e subir o banco** — `npx supabase@latest link --project-ref <ref> && npx supabase@latest db push` · Expected: 2 migrations aplicadas.
- [ ] **Step 3: Secrets** — `npx supabase@latest secrets set RADAR_ALLOWED_ORIGINS="https://lancamentoabc-*.vercel.app,http://localhost:3000" RADAR_IP_SALT=<aleatório 32 bytes> RD_WEBHOOK_SECRET=<aleatório 32 bytes>` (gerar com `openssl rand -hex 32`; guardar num gerenciador de senhas, nunca no repo).
- [ ] **Step 4: Deploy** — `npx supabase@latest functions deploy ingest confirm-lead rd-webhook --no-verify-jwt`
- [ ] **Step 5: Verificar** — `curl -s -o /dev/null -w "%{http_code}" -X POST https://<ref>.supabase.co/functions/v1/ingest -H "Content-Type: text/plain" --data @supabase/functions/ingest/fixtures/batch.json` · Expected: `204`; e `-X POST .../rd-webhook?secret=errado` · Expected: `401`.
- [ ] **Step 6: Admin** — Auth → desligar "Allow new users to sign up"; criar o usuário do dono; `insert into profiles(user_id, role) values ('<uid>','admin')`.
- [ ] **Step 7: Commit** — `git add supabase/.env.example supabase/config.toml && git commit -m "chore(radar): config do projeto remoto"`

---

### Task 7: SDK Radar — núcleo (ids, consentimento, fila, envio, API)

**Files:**
- Create: `frontend/src/lib/radar/{config,ids,consent,attribution,queue,transport,index}.js`, `frontend/src/lib/radar/__tests__/{ids,attribution,queue,transport,index}.test.js`

**Interfaces:**
- Consumes: contrato `Batch` da Task 3 (mesmos nomes de campo).
- Produces:
  - `config.js`: `RADAR_URL = process.env.REACT_APP_RADAR_URL || ""`, `RADAR_ENV = process.env.REACT_APP_RADAR_ENV || "staging"`. Sem URL → SDK vira no-op.
  - `ids.js`: `uuid(): string`; `getSessionId(now = Date.now()): string` (sessionStorage `rdr_sid` + `rdr_slast`, renova após 30 min); `getVisitorId(granted: boolean): string | null` (cookie `rdr_vid` + espelho localStorage; `null` se não consentido).
  - `consent.js`: `hasConsent(): boolean`; `onConsentChange(cb: (granted: boolean) => void): () => void` — escuta `window` `radar:consent` (`detail.granted`).
  - `attribution.js`: `readAttribution(href: string, referrer: string, userAgent: string, width: number): SessionMeta` — lê `utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `keyword`, `matchtype`, `campaign_id`, `adgroup_id`; `device` ∈ `mobile|tablet|desktop`; `screen` = `"LxA"`; `landing_url` sem fragmento.
  - `queue.js`: `createQueue({ send, flushMs = 5000, maxBatch = 20, setTimer = setTimeout })` → `{ push(event): void, flush(useBeacon?: boolean): void, size(): number }`.
  - `transport.js`: `sendBatch(url: string, body: string, useBeacon: boolean): boolean` — beacon com `Blob([...], {type:"text/plain;charset=UTF-8"})`; senão `fetch(url, {method:"POST", body, keepalive:true, headers:{"Content-Type":"text/plain;charset=UTF-8"}})` com `.catch(() => {})`; nunca lança.
  - `index.js` (API pública): `initRadar(): void` (idempotente; registra `pagehide` e `visibilitychange` → `flush(true)`); `track(type: string, props?: object, opts?: {name?: string, section?: string}): void`; `identifyLead({ name, phone, email, formId }): string` (gera `lead_token`, guarda em `sessionStorage['radar_lead_token']`, envia `lead_submitted` com flush imediato por beacon, devolve o token mesmo se o envio falhar); `getLeadToken(): string | null`; `confirmLead(token: string, timeoutMs = 3000): Promise<{first_use: boolean, user_data: object|null} | null>` (POST `${RADAR_URL}/confirm-lead`; `null` em erro/timeout).

- [ ] **Step 1: Testes** (Jest/jsdom)

```js
// ids.test.js
expect(getVisitorId(false)).toBeNull();
const v = getVisitorId(true); expect(getVisitorId(true)).toBe(v); expect(document.cookie).toMatch(/rdr_vid=/);
const s = getSessionId(0); expect(getSessionId(29 * 60e3)).toBe(s); expect(getSessionId(29 * 60e3 + 31 * 60e3)).not.toBe(s);
// attribution.test.js
const a = readAttribution("https://x.app/?utm_source=google&gclid=ABC&keyword=apartamento+sbc#faq", "", iPhoneUA, 375);
expect(a).toMatchObject({ utm_source: "google", gclid: "ABC", keyword: "apartamento sbc", device: "mobile", landing_url: "https://x.app/?utm_source=google&gclid=ABC&keyword=apartamento+sbc" });
// queue.test.js
// 20 pushes → send chamado 1x com 20 eventos; 3 pushes + timer de 5 s → send com 3; flush() vazio não chama send
// transport.test.js
global.fetch = jest.fn(() => Promise.reject(new Error("offline")));
expect(() => sendBatch("u", "{}", false)).not.toThrow();
navigator.sendBeacon = jest.fn(() => true); expect(sendBatch("u", "{}", true)).toBe(true);
// index.test.js
// sem REACT_APP_RADAR_URL: track() não chama fetch nem sendBeacon
// identifyLead com fetch rejeitando ainda devolve token uuid e grava sessionStorage.radar_lead_token
// lote enviado contém v:1, env, session_id, session.landing_url e o evento
```

- [ ] **Step 2: Rodar e ver falhar** — Run (em `frontend/`): `npm install` (se faltar) e `CI=true npx craco test --watchAll=false src/lib/radar` · Expected: FAIL
- [ ] **Step 3: Implementar** os 7 módulos.
- [ ] **Step 4: Rodar e ver passar** · Expected: PASS
- [ ] **Step 5: Commit** — `git add frontend/src/lib/radar && git commit -m "feat(radar): núcleo do SDK"`

---

### Task 8: SDK Radar — coletores de comportamento

**Files:**
- Create: `frontend/src/lib/radar/collectors/{page,sections,clicks,video}.js` + `__tests__/collectors.test.js`
- Modify: `frontend/src/components/FAQ.jsx` (no clique que **abre** uma pergunta: `track("faq_open", { question: item.q }, { section: "faq" })`), `frontend/src/components/Slider3D.jsx` (em cada troca de índice: `track("slider_view", { index, title: SLIDES[index].title })`), `frontend/src/components/HeroSection.jsx` (atributo `data-radar-video="hero"` no `<video>`)

**Interfaces:**
- Consumes: `track` (Task 7).
- Produces: cada coletor exporta `start(): () => void` (devolve função de desligar), chamado por `initRadar`:
  - `page.start`: `page_view` ao iniciar e a cada `popstate`/`pushState`; `scroll_depth` com `{pct}` em 25/50/75/100, uma vez cada por página.
  - `sections.start`: IntersectionObserver (threshold 0.5) em `section[id]`; ao sair da seção (ou no `pagehide`), `section_view` com `{seconds}` arredondado, se ≥ 1 s; `section` = id.
  - `clicks.start`: listener `click` em captura no `document`; alvo = `closest("a,button,[data-radar]")`; `label = data-radar || data-testid || texto (máx. 60 caracteres)`; `href` sem query; `section` = `closest("section[id]")?.id`; destino `wa.me`/`whatsapp.com` → `whatsapp_click`, senão `cta_click`. 3 cliques em ≤ 700 ms num raio de 30 px → `rage_click`.
  - `video.start`: em `video[data-radar-video]`: `video` com `name` = `play|pause|unmute|progress` e `{pct}` em 25/50/75/100.

- [ ] **Step 1: Testes** — clique num `<button data-testid="hero-cta-visit">` dentro de `<section id="top">` → `track("cta_click", {label:"hero-cta-visit", ...}, {section:"top"})`; `<a href="https://wa.me/55...?text=oi">` → `whatsapp_click` com `href` sem `?text`; 3 cliques rápidos → um `rage_click`; rolagem simulada até 60% → `scroll_depth` 25 e 50 uma vez cada; vídeo com `timeupdate` em 52% → `progress` 25 e 50; `volumechange` com `muted=false` → `unmute`.
- [ ] **Step 2: Rodar e ver falhar** — `CI=true npx craco test --watchAll=false src/lib/radar` · Expected: FAIL
- [ ] **Step 3: Implementar** os coletores e as 3 alterações de componente.
- [ ] **Step 4: Rodar e ver passar** · Expected: PASS
- [ ] **Step 5: Commit** — `git commit -am "feat(radar): coletores de comportamento"` (com `git add` dos arquivos novos)

---

### Task 9: Captura de formulário (qualquer RD) e /obrigado confiável

**Files:**
- Create: `frontend/src/lib/radar/collectors/forms.js`, `__tests__/forms.test.js`, `frontend/src/components/__tests__/ThankYou.test.jsx`
- Modify: `frontend/src/components/ThankYou.jsx`, `frontend/src/lib/tracking.js:9-34` (`trackLeadConversion`)

**Interfaces:**
- Consumes: `track`, `identifyLead`, `getLeadToken`, `confirmLead` (Task 7).
- Produces:
  - `forms.start`: delegação no `document` (pega o formulário embutido e o pop-up do RD, que é injetado depois). Um `form` é "de lead" se contém `input[name="mobile_phone"]` ou `input[name="email"]`. `form_view` quando `#rd-form-section` fica 50% visível; `form_start` no primeiro `focusin` (uma vez por form); `form_field_complete` com `{field}` no `change` de campo preenchido; `submit` em captura → `form_submit_attempt` + `identifyLead({ name, phone: mobile_phone, email, formId: form.id || container id })`; `pagehide` com form iniciado e não enviado → `form_abandon` com `{last_field}`. Nunca chama `preventDefault`.
  - `trackLeadConversion(userData)`: mantém a trava de sessão atual e passa a incluir `user_data` (Enhanced Conversions) no push do `generate_lead`.
  - `ThankYou`: ao montar, `track("thank_you_view")`; se houver `getLeadToken()`, `await confirmLead(token)` (máx. 3 s) e chama `trackLeadConversion(result.user_data)` **só se** `result?.first_use === true`; sem token ou sem resposta → nenhum `generate_lead`. O redirecionamento automático de 5 s e o botão seguem iguais, e o evento `whatsapp_click` leva `{ lead_token }` nas props.

- [ ] **Step 1: Testes**

```js
// forms.test.js — form RD montado no DOM
// submit → identifyLead chamado com { name:"Ana", phone:"(11) 94038-3680", email:"a@x.com" } e evento NÃO prevenido
expect(submitEvent.defaultPrevented).toBe(false);
// form inserido dinamicamente depois do start (pop-up) também é capturado
// foco + pagehide sem submit → form_abandon { last_field: "email" }
// ThankYou.test.jsx
// sem token → nenhum dataLayer.push com event "generate_lead"
// token + confirmLead → {first_use:true, user_data:{...}} → exatamente 1 push generate_lead com user_data
// token + confirmLead → {first_use:false} → nenhum generate_lead
// confirmLead → null (endpoint fora) → nenhum generate_lead e o redirect ao WhatsApp continua agendado
```

- [ ] **Step 2: Rodar e ver falhar** — `CI=true npx craco test --watchAll=false src/lib/radar src/components/__tests__` · Expected: FAIL
- [ ] **Step 3: Implementar** `forms.js`, alterar `tracking.js` e `ThankYou.jsx`.
- [ ] **Step 4: Rodar e ver passar** · Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(radar): captura de lead em qualquer form RD e /obrigado com token"`

---

### Task 10: Ligar o Radar na LP (só na branch) e consentimento

**Files:**
- Modify: `frontend/src/App.js` (chamar `initRadar()` uma vez no `App`), `frontend/src/components/CookieConsent.jsx` (no aceitar/recusar: `window.dispatchEvent(new CustomEvent("radar:consent", { detail: { granted } }))` e `track("consent", { granted })`)
- Create: `frontend/.env.example` (`REACT_APP_RADAR_URL=`, `REACT_APP_RADAR_ENV=staging`)

**Interfaces:**
- Consumes: `initRadar`, `track`, coletores (Tasks 7–9).
- Produces: build da branch `radar` com Radar ativo quando `REACT_APP_RADAR_URL` existe.

- [ ] **Step 1: Teste** — em `index.test.js`, aceitar consentimento via `radar:consent` faz o próximo lote trazer `visitor_id` não nulo; recusar mantém `null`.
- [ ] **Step 2: Rodar e ver falhar → implementar → rodar e ver passar** — `CI=true npx craco test --watchAll=false`
- [ ] **Step 3: Build e tamanho** — Run: `npm run build` e medir o chunk do Radar (`source-map-explorer` ou gzip do arquivo) · Expected: build ok e Radar ≤ 6 KB gzip.
- [ ] **Step 4: Variáveis na Vercel** — no projeto `lancamentoabc`, definir `REACT_APP_RADAR_URL` e `REACT_APP_RADAR_ENV=staging` **somente no ambiente Preview** (Production fica sem → Radar desligado mesmo se algo vazar para produção).
- [ ] **Step 5: Commit e push da branch** — `git commit -am "feat(radar): ativa SDK na LP (preview)" && git push -u origin radar` · Expected: a Vercel cria um Preview Deployment; **o workflow de FTP não roda** (ele só dispara no `master`). Se o projeto Vercel não estiver ligado ao Git, publicar como preview com `npx vercel deploy` (sem `--prod`) a partir de `frontend/`.

---

### Task 11: Validação ponta a ponta no preview

**Files:**
- Create: `docs/superpowers/plans/radar-01-validacao.sql` (as consultas abaixo, para reuso)

- [ ] **Step 1: Webhook do RD** — o dono configura no RD Station o webhook de conversão para `https://<ref>.supabase.co/functions/v1/rd-webhook?secret=<RD_WEBHOOK_SECRET>` (spec §11.4).
- [ ] **Step 2: Jornada de teste** — no preview, abrir `/?utm_source=teste&utm_campaign=radar&gclid=TESTE123&keyword=apartamento+sbc`, aceitar cookies, tocar o vídeo e ativar o som, abrir 2 perguntas do FAQ, passar 3 slides, preencher o formulário com `TESTE RADAR` e um WhatsApp de teste, enviar, esperar a /obrigado e clicar em "Ir para o WhatsApp".
- [ ] **Step 3: Conferir no banco** (SQL Editor):

```sql
select type, name, section, occurred_at from events where lead_id = (select id from leads where name = 'TESTE RADAR') order by occurred_at;
-- Expected: page_view → video(play/unmute/progress) → faq_open ×2 → slider_view ×3 → form_start → form_submit_attempt → lead_submitted → thank_you_view → whatsapp_click
select submitted_at is not null s, rd_confirmed_at is not null rd, thank_you_at is not null ty, whatsapp_at is not null wa from leads where name = 'TESTE RADAR';
-- Expected: true, true, true, true
select gclid, keyword, utm_campaign from sessions where id = (select first_session_id from leads where name = 'TESTE RADAR');
-- Expected: TESTE123 | apartamento sbc | radar
select count(*) from events where props ? 'phone' or props ? 'email' or props ? 'name';
-- Expected: 0
```

- [ ] **Step 4: Casos de borda** — recarregar a /obrigado e abrir em nova aba (no `dataLayer` do console, `generate_lead` aparece 1 vez só); testar com bloqueador de anúncio ligado e com a função `ingest` pausada (formulário envia e redireciona normalmente); enviar de novo com o mesmo telefone em outro formato (continua 1 lead); conferir o primeiro registro de `rd_webhook_raw` contra a fixture da Task 5.
- [ ] **Step 5: Commit** — `git add docs/superpowers/plans/radar-01-validacao.sql && git commit -m "test(radar): roteiro de validação ponta a ponta"`

**Pronto quando:** os 4 checks da Step 3 batem, os casos de borda da Step 4 passam, todos os testes (`supabase test db`, `deno test supabase/functions`, `craco test`) estão verdes, e o `master` não recebeu nenhum commit.
