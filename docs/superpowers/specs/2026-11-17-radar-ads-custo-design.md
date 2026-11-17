# Radar — Custo do Google Ads no painel (desenho curto)

**Pedido do dono (2026-11-17):** "Dá para integrar o Ads do Google ao painel para ver custo por lead etc.?" → escolheu o caminho do **script do Google Ads**.

## Por quê
O Google mostra as conversões que ele detecta. O dono quer o custo dividido pelos leads que o **Radar** registrou (nome + WhatsApp), por campanha, palavra-chave e dia.

## Abordagens consideradas
1. **Script do Google Ads (escolhida).** Roda dentro da conta do Ads de hora em hora e envia custos e cliques para uma Edge Function. Sem developer token, sem OAuth.
2. API oficial do Google Ads: exige developer token aprovado (dias) e conta MCC. Mesmo resultado na tela.
3. Exportar planilha à mão: manual, sempre atrasado.

## Desenho
- **Script** (`integrations/google-ads/radar-ads-sync.js`): a cada execução manda os últimos 30 dias de custo por campanha e por palavra-chave (o Google ainda ajusta custos de dias recentes) e os cliques (gclid) dos últimos 30 dias via `click_view`. Cliques vão em lotes de 2.000.
- **Edge Function `ads-sync`** (verify_jwt=false; só servidor→servidor, sem CORS): exige o cabeçalho `x-radar-secret` igual ao segredo `RADAR_ADS_SECRET` (comparação em tempo constante; sem segredo configurado → 503). Valida o formato e chama o RPC `ads_ingest` (só service_role).
- **`ads_ingest`**: substitui de forma atômica as estatísticas da conta no intervalo enviado (apaga e insere — assim linhas que sumiram no Google somem aqui) e faz upsert dos cliques. Registra a execução em `ads_sync_runs`.
- **Tabelas** (RLS: só admin lê; escrita só via service_role): `ads_campaign_daily`, `ads_keyword_daily`, `ads_clicks`, `ads_sync_runs`. Valores em micros (bigint), como o Google entrega.
- **Atribuição do lead a uma campanha** (`panel_ads_lead_attribution`), pela 1ª sessão do lead, nesta ordem:
  1. `sessions.gclid` = `ads_clicks.gclid` → campanha, grupo e palavra-chave exatos;
  2. `sessions.campaign_id` (ValueTrack `{campaignid}` no sufixo do URL final), se a campanha existe no Google Ads;
  3. `sessions.utm_campaign` = id da campanha ou nome da campanha (sem diferenciar maiúsculas).
  2 e 3 só valem com sinal do Google (gclid/gbraid/wbraid ou utm_source google*) e sem fbclid: tráfego da Meta nunca vira lead do Google.
  Só leads de produção. O dia do lead é o dia de São Paulo do envio.
- **Views do painel**: `panel_ads_campaigns_daily` e `panel_ads_keywords_daily` (custo, cliques, impressões, conversões do Google e leads do Radar por dia), juntando custo e leads com full join (lead atribuído a campanha sem custo no dia também aparece).
- **Tela "Anúncios"** (`/painel/anuncios`): período; indicadores (investimento, leads do Radar, custo por lead, cliques, CPC, conversões do Google); tabela por campanha; tabela por palavra-chave; última sincronização. Mostra sempre dados de produção.

## Fora do escopo (decisão minha, para ir rápido)
Termos de busca, Meta Ads, campanha/palavra-chave na página do lead. (A limpeza de `ads_clicks` após 13 meses entrou, via pg_cron.)

## Pendências conhecidas
- As views recalculam a atribuição de todos os leads a cada consulta; com muitos leads, trocar por um RPC que filtra por período primeiro.
- `verify_jwt=false` da função `ads-sync` não está em `supabase/config.toml` (o projeto não tem um; as funções são publicadas pelo MCP). Num deploy pela CLI, usar `--no-verify-jwt`.

## O que o dono faz
Criar o segredo `RADAR_ADS_SECRET` no Supabase, colar o script no Google Ads com a mesma chave, autorizar e agendar de hora em hora. Recomendado: sufixo do URL final com `campaign_id={campaignid}&adgroup_id={adgroupid}&keyword={keyword}&matchtype={matchtype}` como reserva quando não houver gclid.
