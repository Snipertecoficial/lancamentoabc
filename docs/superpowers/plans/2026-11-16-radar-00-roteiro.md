# Radar — Roteiro geral (4 planos)

**Spec:** `docs/superpowers/specs/2026-11-16-painel-tracking-design.md`

O desenho cobre 4 subsistemas independentes. Cada um vira um plano próprio, que entrega software funcionando e testável sozinho. Os planos 2–4 são escritos em detalhe quando o anterior for entregue, porque dependem do schema e dos eventos reais que o Plano 1 vai produzir.

| # | Plano | Entrega testável | Depende de | Equipe |
|---|---|---|---|---|
| 1 | **Fundação + Coleta** (`2026-11-16-radar-01-fundacao-coleta.md`) | Supabase com schema/RLS, 3 Edge Functions, SDK Radar na LP de testes; uma jornada real gravada de ponta a ponta | — | Banco, Back, Front |
| 2 | **Painel MVP** | App com login (só admin): Leads, Linha do tempo, Funil, Ao vivo, Campanhas, Atenção, Saúde | Plano 1 (schema + eventos) | Designer, Front, Banco (views) |
| 3 | **Correções da LP + virada** | As 12 correções na branch `radar`, checklist de virada, merge no `master` | Plano 1 (tracker já na branch) | Front, Designer |
| 4 | **Fechar o ciclo com o Google Ads** | Estágios de qualificação, alertas de lead, conversões offline/enhanced, custo por lead, cidade por IP | Planos 1–3 + acesso Ads | Back, Front |

## O que o designer pode começar já (sem esperar o Plano 1)
- Wireframes e UI do painel (as 8 telas da seção 7.5 da spec), na paleta azul da Espontone (`#061224`, `#0A1930`, `#12294A`, `#3A70A3`, `#5B95CE`, `#7DB4E8`), tipografia Playfair Display + Inter.
- Componentes: barra inferior fixa de contato no mobile, novo banner de cookies, página de Política de Privacidade, novo estilo do formulário RD (itens 5, 6 e 8 da spec).

## Esboço do Plano 2 — Painel MVP
1. Repo/projeto `painel-radar` (React + Vite + TS + Tailwind + shadcn + Recharts), Supabase Auth com cadastro público desligado, rota protegida, usuário admin criado.
2. Views SQL: `lead_journey(lead_id)`, `funnel_daily`, `campaign_daily`, `section_engagement`, `faq_interest`, `tracking_health`, `live_sessions` (últimos 5 min) — com testes pgTAP.
3. Telas: Visão geral → Leads (tabela, filtros, CSV, temperatura) → Linha do tempo do lead → Funil → Campanhas → Atenção → Ao vivo (Realtime) → Saúde.
4. Regra de temperatura (`lead_score(lead_id)`): vídeo > 50%, FAQ de preço/financiamento, visitas ≥ 2, tempo total, palavra-chave de fundo de funil.
5. Deploy na Vercel (projeto separado), filtro de ambiente `staging|production` em todas as telas.

## Esboço do Plano 3 — Correções + virada
1. Itens 1–12 da seção 7.6 da spec, um commit por item, todos na branch `radar`.
1b. LGPD no banco (spec §7.3): retenção de eventos por 13 meses (job `pg_cron`) e função `forget_person(phone_e164, email)` que apaga/anonimiza o titular — com teste pgTAP. Precisa estar pronto antes da virada.
2. GTM: conversão do Ads disparando em `generate_lead` (que agora só sai com `lead_token` válido); remover gatilhos de form submit/link click; renomear o evento GA4 "GA4".
3. Checklist de virada: jornada testada nos dois formulários (embutido + pop-up), contagem Radar × RD bate por 3 dias, Lighthouse ≥ atual, URL usada nos anúncios confirmada (Vercel ou Hostgator), rollback = reverter o merge.
4. Merge `radar` → `master` (publica Vercel + Hostgator) e troca do `REACT_APP_RADAR_ENV` para `production`.

## Esboço do Plano 4 — Fechar o ciclo
1. Estágios de qualificação no painel (contatado, visita agendada, visitou, vendeu, descartado) com histórico.
2. Alerta de lead novo/quente (e-mail ou WhatsApp para você).
3. Upload de conversões confirmadas/qualificadas ao Google Ads (gclid + telefone/e-mail em hash), job agendado.
4. Custo por campanha/palavra-chave via API do Ads → custo por lead no painel.
5. Cidade/UF por IP (base de geolocalização) e reavaliar endpoint no mesmo domínio.
