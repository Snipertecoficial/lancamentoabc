/**
 * Radar — liga o Google Ads ao painel (lancamento.espontone.com.br/painel/anuncios). Versão 2.
 *
 * Como instalar (uma vez):
 *   1. Google Ads → Ferramentas → Ações em massa → Scripts → abra o script "Radar" (ou "+" para um novo).
 *   2. Apague o que estiver lá e cole este arquivo inteiro.
 *   3. Em RADAR.SECRET, troque o texto pela mesma chave cadastrada no Supabase (RADAR_ADS_SECRET).
 *   4. Clique em "Autorizar" e depois em "Executar" (não em "Visualizar": nesse modo o Google não aplica
 *      as alterações pedidas no painel). O registro deve terminar em "Radar: ok".
 *   5. Salve e, na lista de scripts, coloque a frequência em "A cada hora".
 *
 * O que ele faz a cada execução:
 *   - aplica as alterações pedidas no painel (pausar/ativar campanha ou palavra-chave, orçamento diário,
 *     palavra-chave negativa) e devolve o resultado de cada uma;
 *   - envia custo, cliques, impressões e conversões por dia, por campanha e por palavra-chave
 *     (últimos 90 dias, porque o Google ainda ajusta dias recentes) e o código de cada clique (gclid)
 *     dos últimos 30 dias, para ligar cada lead à campanha exata;
 *   - envia a situação atual das campanhas (ativa/pausada, orçamento) e das palavras-chave, os termos de
 *     pesquisa e o custo por rede (Pesquisa, YouTube, Display...) dos últimos 30 dias;
 *   - depois fica uns 25 minutos olhando a fila do painel a cada minuto, para aplicar alterações rápido.
 * Nenhum dado pessoal sai do Google Ads.
 */
var RADAR = {
  ENDPOINT: 'https://cnsmmwbqfbaimwexmtkx.supabase.co/functions/v1/ads-sync',
  SECRET: 'COLE_AQUI_A_CHAVE_DO_RADAR',
  COST_DAYS: 90,
  CLICK_DAYS: 30,
  CLICK_BATCH: 2000,
  INSIGHT_DAYS: 30,
  WATCH_MINUTES: 25,
  WATCH_SECONDS: 60
};

function main() {
  if (!RADAR.SECRET || RADAR.SECRET.indexOf('COLE_AQUI') === 0) {
    throw new Error('Radar: cole a chave em RADAR.SECRET antes de executar.');
  }
  var started = Date.now();
  var ctx = radarContext_();
  var preview = radarIsPreview_();
  if (preview) {
    Logger.log('Radar: modo Visualizar — as alterações pedidas no painel ficam para a próxima execução de verdade.');
  } else {
    radarApplyCommands_(ctx);
  }

  var from = radarAddDays_(ctx.today, -(RADAR.COST_DAYS - 1));
  var stats = {
    date_from: from,
    date_to: ctx.today,
    campaigns: radarCampaigns_(from, ctx.today),
    keywords: radarKeywords_(from, ctx.today)
  };
  var res = radarPost_(radarWith_(ctx.base, { stats: stats }));
  Logger.log('Radar: custos de ' + from + ' a ' + ctx.today + ' enviados (' + res.campaigns + ' linhas de campanha, ' + res.keywords + ' de palavra-chave).');

  radarSendState_(ctx);
  radarSendInsights_(ctx);

  var clicks = [];
  for (var i = 0; i < RADAR.CLICK_DAYS; i++) {
    clicks = clicks.concat(radarClicks_(radarAddDays_(ctx.today, -i)));
  }
  for (var j = 0; j < clicks.length; j += RADAR.CLICK_BATCH) {
    radarPost_(radarWith_(ctx.base, { clicks: clicks.slice(j, j + RADAR.CLICK_BATCH) }));
  }
  Logger.log('Radar: ' + clicks.length + ' cliques dos últimos ' + RADAR.CLICK_DAYS + ' dias enviados.');

  if (!preview) radarWatch_(ctx, started);
  Logger.log('Radar: ok.');
}

function radarContext_() {
  var account = AdsApp.currentAccount();
  var tz = account.getTimeZone();
  var customerId = String(account.getCustomerId()).replace(/-/g, '');
  return {
    customerId: customerId,
    today: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    base: { customer_id: customerId, currency: account.getCurrencyCode(), time_zone: tz }
  };
}

// In "Visualizar" the Google Ads API does not apply mutations: never take commands from the queue then.
function radarIsPreview_() {
  try {
    return AdsApp.getExecutionInfo().isPreview();
  } catch (e) {
    Logger.log('Radar: não deu para saber se é Visualizar (' + e + '); alterações do painel ficam para depois.');
    return true;
  }
}

/* ---------- alterações pedidas no painel ---------- */

// Takes the pending edits, applies each one and reports the results. Returns how many it handled.
function radarApplyCommands_(ctx) {
  var res = radarPost_(radarWith_(ctx.base, { pull: true }));
  var commands = res.commands || [];
  if (!commands.length) return 0;
  var results = [];
  for (var i = 0; i < commands.length; i++) {
    var r = radarApply_(ctx, commands[i]);
    Logger.log('Radar: alteração #' + r.id + ' (' + commands[i].kind + ') ' + (r.ok ? 'aplicada' : 'falhou: ' + r.error));
    results.push(r);
  }
  radarPost_(radarWith_(ctx.base, { results: results }));
  return commands.length;
}

function radarApply_(ctx, c) {
  var fail = function (msg) { return { id: c.id, ok: false, error: msg }; };
  var v = c.value || {};
  var prefix = 'customers/' + ctx.customerId;
  var op;
  try {
    if (c.kind === 'campaign_status') {
      op = { campaignOperation: { update: { resourceName: prefix + '/campaigns/' + c.campaign_id, status: v.status }, updateMask: 'status' } };
    } else if (c.kind === 'campaign_budget') {
      var budget = radarBudgetOf_(c.campaign_id);
      if (!budget) return fail('Não encontrei o orçamento desta campanha.');
      op = { campaignBudgetOperation: { update: { resourceName: budget, amountMicros: v.amount_micros }, updateMask: 'amount_micros' } };
    } else if (c.kind === 'keyword_status') {
      op = { adGroupCriterionOperation: { update: { resourceName: prefix + '/adGroupCriteria/' + c.ad_group_id + '~' + c.criterion_id, status: v.status }, updateMask: 'status' } };
    } else if (c.kind === 'campaign_negative') {
      op = { campaignCriterionOperation: { create: { campaign: prefix + '/campaigns/' + c.campaign_id, negative: true, keyword: { text: v.text, matchType: v.match_type } } } };
    } else {
      return fail('Tipo de alteração desconhecido: ' + c.kind);
    }
    var result = AdsApp.mutate(op);
    if (result.isSuccessful()) return { id: c.id, ok: true };
    var errors = result.getErrorMessages() || [];
    return fail(errors.length ? errors.join(' | ') : 'O Google Ads recusou a alteração.');
  } catch (e) {
    return fail(String(e && e.message ? e.message : e));
  }
}

function radarBudgetOf_(campaignId) {
  var rows = radarRows_(
    'SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ' + Number(campaignId),
    function (r) { return radarGet_(r, 'campaign.campaignBudget'); });
  return rows[0] || null;
}

// After syncing, keep checking the queue so an edit made in the panel lands within about a minute.
function radarWatch_(ctx, started) {
  var rounds = Math.floor(RADAR.WATCH_MINUTES * 60 / RADAR.WATCH_SECONDS);
  for (var i = 0; i < rounds; i++) {
    if (Date.now() - started >= RADAR.WATCH_MINUTES * 60000) break;
    Utilities.sleep(RADAR.WATCH_SECONDS * 1000);
    try {
      if (radarApplyCommands_(ctx) > 0) radarSendState_(ctx);
    } catch (e) {
      Logger.log('Radar: falha ao olhar a fila do painel (' + e + '); tento de novo em ' + RADAR.WATCH_SECONDS + ' s.');
    }
  }
}

/* ---------- situação atual e análise ---------- */

function radarSendState_(ctx) {
  var campaigns = radarRows_(
    'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, ' +
    'campaign_budget.id, campaign_budget.amount_micros, campaign_budget.explicitly_shared ' +
    'FROM campaign WHERE campaign.status != \'REMOVED\'',
    function (r) {
      var budgetId = radarGet_(r, 'campaignBudget.id');
      var amount = radarGet_(r, 'campaignBudget.amountMicros');
      return {
        campaign_id: String(radarGet_(r, 'campaign.id')),
        campaign_name: radarGet_(r, 'campaign.name'),
        status: radarGet_(r, 'campaign.status'),
        channel: radarGet_(r, 'campaign.advertisingChannelType'),
        bidding_strategy: radarGet_(r, 'campaign.biddingStrategyType'),
        budget_id: budgetId ? String(budgetId) : null,
        budget_micros: amount === null ? null : amount,
        budget_shared: radarGet_(r, 'campaignBudget.explicitlyShared') === true
      };
    });
  var keywords = radarRows_(
    'SELECT campaign.id, ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ' +
    'ad_group_criterion.keyword.match_type, ad_group_criterion.status FROM ad_group_criterion ' +
    'WHERE ad_group_criterion.type = \'KEYWORD\' AND ad_group_criterion.negative = FALSE ' +
    'AND ad_group_criterion.status != \'REMOVED\' AND ad_group.status != \'REMOVED\' AND campaign.status != \'REMOVED\'',
    function (r) {
      return {
        campaign_id: String(radarGet_(r, 'campaign.id')),
        ad_group_id: String(radarGet_(r, 'adGroup.id')),
        criterion_id: String(radarGet_(r, 'adGroupCriterion.criterionId')),
        ad_group_name: radarGet_(r, 'adGroup.name'),
        keyword_text: radarGet_(r, 'adGroupCriterion.keyword.text'),
        match_type: radarGet_(r, 'adGroupCriterion.keyword.matchType'),
        status: radarGet_(r, 'adGroupCriterion.status')
      };
    });
  radarPost_(radarWith_(ctx.base, { state: { campaigns: campaigns, keywords: keywords } }));
  Logger.log('Radar: situação de ' + campaigns.length + ' campanhas e ' + keywords.length + ' palavras-chave enviada.');
}

// Search terms and cost per network, for analysis. A failure here never stops the cost sync.
function radarSendInsights_(ctx) {
  try {
    var from = radarAddDays_(ctx.today, -(RADAR.INSIGHT_DAYS - 1));
    var range = 'segments.date BETWEEN \'' + from + '\' AND \'' + ctx.today + '\'';
    var terms = radarRows_(
      'SELECT campaign.id, ad_group.id, search_term_view.search_term, search_term_view.status, ' +
      'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
      'FROM search_term_view WHERE ' + range + ' AND metrics.impressions > 0 ORDER BY metrics.impressions DESC LIMIT 20000',
      function (r) {
        var term = radarGet_(r, 'searchTermView.searchTerm');
        if (!term) return null;
        return {
          campaign_id: String(radarGet_(r, 'campaign.id')),
          ad_group_id: String(radarGet_(r, 'adGroup.id')),
          search_term: term,
          status: radarGet_(r, 'searchTermView.status'),
          impressions: radarGet_(r, 'metrics.impressions') || 0,
          clicks: radarGet_(r, 'metrics.clicks') || 0,
          cost_micros: radarGet_(r, 'metrics.costMicros') || 0,
          conversions: radarGet_(r, 'metrics.conversions') || 0
        };
      });
    var networks = radarRows_(
      'SELECT campaign.id, segments.ad_network_type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
      'FROM campaign WHERE ' + range + ' AND metrics.impressions > 0',
      function (r) {
        return {
          campaign_id: String(radarGet_(r, 'campaign.id')),
          network: radarGet_(r, 'segments.adNetworkType') || 'UNKNOWN',
          impressions: radarGet_(r, 'metrics.impressions') || 0,
          clicks: radarGet_(r, 'metrics.clicks') || 0,
          cost_micros: radarGet_(r, 'metrics.costMicros') || 0,
          conversions: radarGet_(r, 'metrics.conversions') || 0
        };
      });
    radarPost_(radarWith_(ctx.base, { insights: { date_from: from, date_to: ctx.today, search_terms: terms, networks: networks } }));
    Logger.log('Radar: ' + terms.length + ' termos de pesquisa e ' + networks.length + ' linhas por rede enviados.');
  } catch (e) {
    Logger.log('Radar: termos de pesquisa/redes não foram enviados desta vez (' + e + ').');
  }
}

/* ---------- custos e cliques ---------- */

function radarCampaigns_(from, to) {
  return radarRows_(
    'SELECT segments.date, campaign.id, campaign.name, campaign.advertising_channel_type, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
    'FROM campaign WHERE segments.date BETWEEN \'' + from + '\' AND \'' + to + '\' AND metrics.impressions > 0',
    function (r) {
      return {
        day: radarGet_(r, 'segments.date'),
        campaign_id: String(radarGet_(r, 'campaign.id')),
        campaign_name: radarGet_(r, 'campaign.name'),
        channel: radarGet_(r, 'campaign.advertisingChannelType'),
        impressions: radarGet_(r, 'metrics.impressions') || 0,
        clicks: radarGet_(r, 'metrics.clicks') || 0,
        cost_micros: radarGet_(r, 'metrics.costMicros') || 0,
        conversions: radarGet_(r, 'metrics.conversions') || 0
      };
    });
}

function radarKeywords_(from, to) {
  return radarRows_(
    'SELECT segments.date, campaign.id, ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ' +
    'ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
    'FROM keyword_view WHERE segments.date BETWEEN \'' + from + '\' AND \'' + to + '\' AND metrics.impressions > 0',
    function (r) {
      return {
        day: radarGet_(r, 'segments.date'),
        campaign_id: String(radarGet_(r, 'campaign.id')),
        ad_group_id: String(radarGet_(r, 'adGroup.id')),
        criterion_id: String(radarGet_(r, 'adGroupCriterion.criterionId')),
        ad_group_name: radarGet_(r, 'adGroup.name'),
        keyword_text: radarGet_(r, 'adGroupCriterion.keyword.text'),
        match_type: radarGet_(r, 'adGroupCriterion.keyword.matchType'),
        impressions: radarGet_(r, 'metrics.impressions') || 0,
        clicks: radarGet_(r, 'metrics.clicks') || 0,
        cost_micros: radarGet_(r, 'metrics.costMicros') || 0,
        conversions: radarGet_(r, 'metrics.conversions') || 0
      };
    });
}

// click_view only accepts one day per query.
function radarClicks_(day) {
  return radarRows_(
    'SELECT click_view.gclid, segments.date, campaign.id, ad_group.id, click_view.keyword, ' +
    'click_view.keyword_info.text, click_view.keyword_info.match_type ' +
    'FROM click_view WHERE segments.date = \'' + day + '\'',
    function (r) {
      var gclid = radarGet_(r, 'clickView.gclid');
      if (!gclid) return null;
      var campaign = radarGet_(r, 'campaign.id');
      var adGroup = radarGet_(r, 'adGroup.id');
      return {
        gclid: gclid,
        day: radarGet_(r, 'segments.date') || day,
        campaign_id: campaign ? String(campaign) : null,
        ad_group_id: adGroup ? String(adGroup) : null,
        criterion_id: radarCriterionId_(radarGet_(r, 'clickView.keyword')),
        keyword_text: radarGet_(r, 'clickView.keywordInfo.text') || null,
        match_type: radarGet_(r, 'clickView.keywordInfo.matchType') || null
      };
    });
}

/* ---------- utilidades ---------- */

function radarRows_(query, map) {
  var out = [];
  var it = AdsApp.search(query);
  while (it.hasNext()) {
    var row = map(it.next());
    if (row) out.push(row);
  }
  return out;
}

function radarPost_(body) {
  var resp = UrlFetchApp.fetch(RADAR.ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-radar-secret': RADAR.SECRET },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code !== 200) {
    throw new Error('Radar respondeu ' + code + ': ' + String(text).slice(0, 300));
  }
  return JSON.parse(text);
}

// "customers/123/adGroupCriteria/456~789" -> "789"
function radarCriterionId_(resourceName) {
  var m = /~(\d+)$/.exec(resourceName || '');
  return m ? m[1] : null;
}

function radarGet_(obj, path) {
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === null || cur === undefined) return null;
    cur = cur[parts[i]];
  }
  return cur === undefined ? null : cur;
}

function radarWith_(base, extra) {
  var out = {};
  var k;
  for (k in base) out[k] = base[k];
  for (k in extra) out[k] = extra[k];
  return out;
}

// "2026-11-17", -1 -> "2026-11-16" (calendar arithmetic, no time zone involved)
function radarAddDays_(ymd, n) {
  var p = ymd.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
  return d.toISOString().slice(0, 10);
}
