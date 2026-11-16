# Painel de Tracking Próprio — Espontone / Lançamento SBC

**Data:** 2026-11-16 · **Status:** aprovado em 2026-11-16 · **Codinome:** Radar

## 1. Intenção (o porquê)

Hoje quem "sabe" o que acontece na LP é o Google (GTM/GA4/Ads), e ele sabe mal: as conversões do Ads disparam no *envio* do formulário (inclusive envios recusados pelo RD) e em cliques genéricos de link, e a página `/obrigado` conta lead para qualquer visita. Não existe um lugar onde se veja **quem** é o lead e **o que ele fez** antes de virar lead.

Queremos ser **a própria fonte da verdade**: cada visita, clique, vídeo assistido, dúvida aberta, formulário começado/enviado, chegada no obrigado e ida ao WhatsApp gravados no **nosso** banco (Supabase), ligados ao lead quando ele se identifica (nome + WhatsApp) — e um **painel com login** para enxergar isso. O Google passa a ser *alimentado* por nós (conversões confirmadas e qualificadas), não o contrário.

## 2. Objetivos

1. Gravar a jornada completa de cada visitante na LP, com origem (UTM, gclid, palavra‑chave, dispositivo, cidade).
2. Capturar nome + WhatsApp em **qualquer** formulário (RD embutido e pop‑up do RD) e ligar retroativamente toda a navegação anterior daquele visitante ao lead.
3. Saber, por lead, o estágio real: tentou enviar → confirmado no RD → chegou no obrigado → clicou no WhatsApp.
4. Painel com login: leads, linha do tempo de cada lead, funil com perdas, campanhas, ao vivo, saúde do tracking.
5. Corrigir os problemas da análise da LP (canonical, texto oculto, /obrigado, botões, LGPD, vídeo, etc.).
6. Fase final: devolver ao Google Ads só conversões **confirmadas** (e depois **qualificadas** pelo corretor), para o Ads otimizar por qualidade.

## 3. Não‑objetivos

- Não é um CRM completo (sem funil de vendas, propostas, contratos). Só um status leve de qualificação na fase 4.
- Não substitui o RD Station (ele continua recebendo os leads e fazendo a automação dele).
- Não substitui GA4/GTM de imediato — eles continuam rodando em paralelo até o painel se provar.
- Sem gravação de sessão (vídeo da tela do usuário/session replay).

## 4. Anti‑objetivos (falharia mesmo "funcionando")

- **Quebrar ou deixar lenta a LP que está no ar.** Tudo é construído numa cópia de testes; produção só muda na virada aprovada.
- **Perder lead.** Se o nosso tracking cair, o formulário do RD e o redirecionamento para o WhatsApp têm que continuar funcionando normalmente (tracking nunca bloqueia o usuário).
- **Vazar dado pessoal.** Nome/WhatsApp nunca ficam legíveis por chave pública; o navegador nunca escreve direto nas tabelas.
- **Números que ninguém confia.** O painel precisa bater com o RD (contagem de leads confirmados) — se não bater, mostra o porquê.

## 5. Restrições conhecidas

- LP: React 19 (CRA/craco) + Tailwind + shadcn, hospedada na Vercel (projeto `lancamentoabc`, só `lancamentoabc.vercel.app`, sem domínio próprio). Repo `Snipertecoficial/lancamentoabc`, branch `main` = produção.
- Formulário de lead = RD Station (`espontone-16aa058dd608303c1ceb`, campos `name`, `email`, `mobile_phone`) + um pop‑up do RD configurado no GTM. O RD **não** repassa os dados para a `/obrigado`.
- GTM `GTM-KNNZJSX4`: Ads `AW-18335937945` (2 conversões, gatilhos de form submit e link click), GA4 `G-LM7R3TBJRP`.
- Supabase: nenhum projeto da Espontone existe; será criado um novo.
- LGPD: dado pessoal + histórico de navegação exige política de privacidade real e base legal clara.

## 6. Abordagens consideradas

| Abordagem | Como | Troca | Decisão |
|---|---|---|---|
| A. Só GTM | Tag Custom HTML no GTM envia eventos ao Supabase | Rápido, mas frágil (depende do DOM), bloqueado por adblock junto com o GTM, não corrige nada da LP | Descartada |
| B. Ferramenta pronta (Clarity/Hotjar/PostHog) | Plugar um SaaS | Rápido, mas os dados são deles, não ligam ao lead do RD nem ao corretor, LGPD com terceiros | Descartada |
| **C. Tracking próprio first‑party + painel próprio** | SDK nosso na LP (cópia de testes), endpoint no mesmo domínio, Supabase como fonte, painel com login | Mais trabalho, mas os dados são nossos, ligam visita → lead → venda, resistem a adblock e alimentam o Ads | **Escolhida** |

Escolha: **C** — você pediu para irmos além do GTM e sermos a fonte.

## 7. Arquitetura

```
 Visitante ──► LP (cópia de testes → depois produção)
                 │  SDK "radar" (≈5 KB): eventos em lote, direto ao Supabase
                 ▼
     Supabase Edge Function `ingest` ──► Postgres (events, sessions, visitors, leads)
       (IP com hash, filtro de bot)
                                              ▲            ▲
     RD Station ── webhook de conversão ──► `rd-webhook`   │
     /obrigado  ── confirma lead_token  ──► `confirm-lead` │
                                                           │
     Painel (app separado, login Supabase Auth) ◄── RLS + Realtime
                                                           │
     Fase 4: job agendado ──► Google Ads (conversões confirmadas/qualificadas)
```

### 7.1 SDK de tracking na LP ("radar")
Módulo próprio em `src/lib/radar/`, sem dependências.

- **Identidade:** `visitor_id` (persistente, cookie 1st‑party + localStorage, 13 meses) e `session_id` (30 min de inatividade). Antes do aceite de cookies: só `session_id` em memória/sessionStorage (sem identificador persistente).
- **Entrada (no início da sessão):** URL de entrada, UTMs, `gclid`/`gbraid`/`wbraid`, `fbclid`, parâmetros ValueTrack do Ads (`{keyword}`, `{matchtype}`, `{campaignid}`, `{adgroupid}`, `{device}`), referrer, dispositivo, tamanho de tela, idioma. Primeiro toque e último toque guardados.
- **Comportamento:**
  - `page_view`, profundidade de rolagem (25/50/75/100).
  - `section_view` + tempo em cada seção (IntersectionObserver em `section[id]`).
  - `cta_click` com rótulo e local (atributo `data-radar="hero_agendar_visita"`; fallback automático para todo `button`/`a`).
  - Vídeo do hero: play, pause, ativou som, % assistido (25/50/75/100).
  - FAQ: qual pergunta abriu (sinal de objeção — preço, entrega, financiamento).
  - Galeria 3D: slides vistos.
  - Formulário: `form_view`, `form_start` (primeiro campo focado), `form_field_complete` por campo, `form_abandon` (saiu com campo preenchido sem enviar), `form_submit_attempt`.
  - `whatsapp_click` **só** quando o destino é realmente o WhatsApp.
  - Sinais de frustração: rage click (3+ cliques rápidos no mesmo ponto).
- **Envio:** fila em memória, lote a cada 5 s ou 20 eventos, `navigator.sendBeacon` ao esconder a página; nunca bloqueia clique nem navegação; falha silenciosa.

### 7.2 Captura do lead (nome + WhatsApp em qualquer formulário)
Três fontes reconciliadas no banco — nenhuma sozinha é confiável:

1. **No envio (navegador):** listener em fase de captura em `document` para qualquer `form` que contenha campos do RD (embutido e pop‑up). Lê `name`, `mobile_phone`, `email`, gera um `lead_token` (UUID), envia evento `lead_submitted` com os dados e guarda o token em `sessionStorage`. Telefone normalizado para E.164 (+55…).
2. **Webhook do RD Station:** o RD avisa quando a conversão foi realmente registrada → função `rd-webhook` grava o payload bruto e marca o lead como **confirmado** (casamento por telefone/e‑mail + janela de tempo).
3. **Página /obrigado:** chama `confirm-lead` com o `lead_token`. Só se o token existir e não tiver sido usado: marca **chegou_obrigado** e só então dispara `generate_lead` no dataLayer (com dados de Enhanced Conversions em hash). Visita direta à /obrigado sem token não conta mais conversão.

**Costura de identidade:** ao identificar o lead, todos os eventos anteriores daquele `visitor_id` (inclusive visitas de dias atrás) passam a pertencer ao lead. Mesmo telefone em dois aparelhos → mesmo lead (dedup por telefone E.164).

**Estágios do lead:** `tentou` → `confirmado_rd` → `chegou_obrigado` → `foi_whatsapp` — guardados como datas independentes (`submitted_at`, `rd_confirmed_at`, `thank_you_at`, `whatsapp_at`), porque o webhook do RD pode chegar antes ou depois da /obrigado; o estágio exibido é o mais avançado preenchido (+ fase 4: `contatado`, `visita_agendada`, `visitou`, `vendeu`, `descartado`).

### 7.3 Banco (Supabase Postgres)
- `visitors` (id, first_seen_at, last_seen_at, first_touch jsonb, last_touch jsonb, lead_id null)
- `sessions` (id, visitor_id, started_at, ended_at, landing_url, utm_*, gclid, keyword, referrer, device, city, region, env `staging|production`, is_bot)
- `events` (id bigint, session_id, visitor_id, lead_id null, occurred_at, received_at, type, name, section, props jsonb) — índices por (occurred_at), (visitor_id), (lead_id), (type); particionamento mensal quando passar de alguns milhões de linhas.
- `leads` (id, phone_e164 único, name, email, stage, score, first_touch, last_touch, rd_lead_id, consent_at, created_at, updated_at)
- `lead_tokens` (token, lead_id, used_at)
- `lead_stage_history` (lead_id, from, to, by, at)
- `rd_webhook_raw` (payload bruto para auditoria)
- `profiles` (user_id, role `admin|gestor|corretor`)
- Views/materializadas: `funnel_daily`, `campaign_daily`, `section_engagement`, `faq_interest`, `tracking_health`.
- **Segurança:** RLS em tudo; o navegador do visitante não tem permissão de escrita em tabela nenhuma (só as Edge Functions, com chave de serviço). Painel lê via usuário autenticado + papel.
- **LGPD:** retenção de eventos 13 meses; função para apagar/anonimizar um titular por telefone/e‑mail; registro do consentimento.

### 7.4 Endpoints (Edge Functions)
- `ingest` (Supabase): recebe lotes direto do navegador, valida tamanho/formato, marca bots, grava IP só em hash, grava `sessions`/`events`, faz a costura de identidade em `lead_submitted`.
- **Revisão (2026-11-16):** a LP de produção também é publicada por FTP na Hostgator (`.github/workflows/deploy.yml`, push no `master`), então um endpoint `/api/t` na Vercel não existiria lá. O SDK envia direto para a função do Supabase, que funciona em qualquer hospedagem. Cidade/UF por IP fica para a fase 4 (precisa de base de geolocalização); um endpoint no mesmo domínio volta a ser avaliado depois da definição do domínio.
- `rd-webhook` (Supabase): autenticação por segredo na URL/header, grava bruto, confirma lead.
- `confirm-lead` (Supabase): valida e consome `lead_token`.
- Fase 4: `ads-upload` (agendado): envia conversões confirmadas/qualificadas ao Google Ads (gclid + telefone/e‑mail em hash).

### 7.5 Painel (app separado)
Projeto próprio na Vercel, React + Vite + TypeScript + Tailwind + shadcn (mesma base da LP, a equipe já conhece), Supabase Auth (e‑mail + senha / link mágico), Recharts.

Telas:
1. **Visão geral:** visitas, leads, taxa de conversão, custo por lead (fase 4), comparação com período anterior.
2. **Ao vivo:** quem está na página agora, em que seção, de onde veio (Supabase Realtime). Ex.: "visitante de SBC, veio de 'apartamento 3 dorms sbc', está no FAQ de preço".
3. **Leads:** tabela com nome, WhatsApp (abre conversa), estágio, origem/palavra‑chave, temperatura (quente/morno/frio), tempo até converter; filtros e exportar CSV.
4. **Linha do tempo do lead (tela principal):** a jornada inteira em ordem — "chegou pelo Ads (palavra X) → assistiu 70% do vídeo → abriu FAQ 'valor' → saiu → voltou 2 dias depois → preencheu → confirmado no RD → obrigado → WhatsApp".
5. **Funil:** visita → viu vídeo → chegou no formulário → começou → enviou → confirmado RD → obrigado → WhatsApp, com % de perda em cada passo e por dispositivo.
6. **Campanhas:** leads e conversão por campanha / palavra‑chave / dispositivo / horário / cidade.
7. **Atenção na página:** quais seções seguram, quais CTAs funcionam, quais dúvidas mais abertas, onde o formulário é abandonado.
8. **Saúde do tracking:** eventos por hora, leads nossos × RD × Ads, alerta se a LP ficar X horas sem eventos.

**Temperatura do lead** (regra simples, ajustável): vídeo > 50%, abriu FAQ de preço/financiamento, voltou mais de uma vez, tempo na página, veio de palavra‑chave de fundo de funil.

### 7.6 Correções da LP (feitas na cópia de testes)
1. Canonical / og:url apontando para a própria LP (e domínio próprio).
2. Remover o `LLMContext` oculto e alinhar schema.org ao conteúdo visível e verdadeiro (sem "casas de campo", sem preços/prazos não oficiais, um único FAQPage).
3. `/obrigado` só conta com `lead_token` válido + `noindex`.
4. Botões: rótulos coerentes com o que fazem; `whatsapp_click` só para WhatsApp real; GTM passa a usar `generate_lead` como gatilho da conversão do Ads (sai o gatilho de form submit).
5. Página de Política de Privacidade real + banner de cookies com consentimento válido (sem "ao continuar navegando…"), menor no mobile.
6. Mobile: botão de contato fixo (barra inferior) e CTA visível no cabeçalho.
7. Vídeo do hero: comprimir (~42 MB → ~5 MB), `preload="none"` no mobile, não ligar o som sozinho.
8. Formulário RD: visual integrado à LP, um só título; avaliar e‑mail opcional.
9. Classes quebradas (`text-[#]/75`) e paleta dourada antiga → paleta azul.
10. Imagens hospedadas por nós (WebP otimizado) em vez de puxar do site da Paddan.
11. Confirmar endereço/cidade real e deixar consistente em todo o site.
12. Reavaliar devolver seções de prova (plantas, localização, lazer, obra) antes do formulário.

## 8. Como entregar sem mexer na LP do cliente

- Branch `radar` no repo da LP → **Preview Deployment da Vercel** (URL própria). `master`/produção intocado — **nunca dar push no `master`** até a virada: ele publica na Vercel e, via GitHub Actions, por FTP na Hostgator.
- Eventos do preview gravados com `env=staging`; o painel filtra por ambiente.
- Virada para produção só após checklist: tracking validado ponta a ponta, contagem bate com o RD por 3+ dias em staging de teste, Lighthouse da LP igual ou melhor, rollback = reverter merge.

## 9. Fases

| Fase | Entrega | Quem lidera |
|---|---|---|
| 0. Fundação | Projeto Supabase, schema + RLS, branch `radar` com preview, segredos | Banco + Back |
| 1. Coleta | SDK na LP (staging), `/api/t`, `ingest`, captura do lead, `confirm-lead`, `rd-webhook` | Front + Back |
| 2. Painel MVP | Login, Leads, Linha do tempo, Funil, Ao vivo, Saúde | Designer + Front |
| 3. Correções + virada | Itens 7.6 na cópia; checklist; merge para produção | Front + Designer |
| 4. Fechar o ciclo | Estágios de qualificação pelo corretor, alerta de lead novo/quente, conversões offline/enhanced no Ads, custo por lead | Back + Front |

## 10. Decisões tomadas por mim (pode mudar)
- Abordagem C (tracking próprio) e branch/preview da Vercel para não tocar a produção.
- Projeto Supabase novo `espontone-radar` em `sa-east-1`.
- Painel como app separado (não dentro da LP).
- Antes do aceite de cookies: coleta só com id de sessão (sem id persistente); após aceite, id persistente. Lead identificado só por envio voluntário do formulário. **Revisar com jurídico.**
- Endpoint no mesmo domínio da LP (resiste a bloqueador de anúncio).
- Telefone E.164 como chave do lead.
- Sem session replay.

## 11. Em aberto (só você responde)
1. ~~Quem acessa o painel~~ — **Decidido (2026-11-16): só o admin (você) por enquanto.** Um único papel `admin`; a tabela `profiles` já nasce com a coluna `role` para abrir para gestores/corretores no futuro sem migração dolorosa. Cadastro público desligado no Supabase Auth.
2. **Domínio** da LP e do painel (ex.: `lancamento.espontone.com.br` e `painel.…`).
3. **Plano do Supabase:** começar no gratuito; para produção recomendo o Pro (US$ 25/mês) — sem pausas e com backup.
4. **RD Station:** confirmar se o plano da conta tem webhooks e quem tem acesso para configurar.
5. **Google Ads (fase 4):** acesso de admin à conta para habilitar conversões offline/enhanced.

## 12. Deixado para quem constrói
Nomes finais de eventos, formato exato dos lotes, limites de rate, regra fina da temperatura, layout detalhado das telas (designer), estratégia de particionamento conforme volume real.
