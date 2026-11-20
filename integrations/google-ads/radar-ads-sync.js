/**
 * Radar — liga o Google Ads ao painel (lancamento.espontone.com.br/painel/anuncios). Versão 3.1.
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
 *     palavra-chave negativa ou nova, raio de localização, "Presença", parceiros de pesquisa e conversão
 *     principal/secundária, e criação de campanha inteira — orçamento, textos, imagens do site,
 *     raio, sinais de público — num lote só, que entra todo ou não entra nada) e devolve o resultado;
 *   - envia custo, cliques, impressões e conversões por dia, por campanha e por palavra-chave
 *     (últimos 90 dias, porque o Google ainda ajusta dias recentes) e o código de cada clique (gclid)
 *     dos últimos 30 dias, para ligar cada lead à campanha exata;
 *   - envia a situação atual das campanhas (ativa/pausada, orçamento) e das palavras-chave, os termos de
 *     pesquisa e o custo por rede (Pesquisa, YouTube, Display...) dos últimos 30 dias;
 *   - envia relatórios para análise: de onde as pessoas viram os anúncios (cidade e bairro), como cada
 *     campanha está segmentada (raio, cidades, presença/interesse, redes) e quais conversões existem
 *     e quais geraram as conversões (últimos 90 dias), além do índice de qualidade das palavras-chave,
 *     dos motivos do Google para cada campanha aparecer pouco e da aprovação dos anúncios;
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
  radarSendReports_(ctx);

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
    } else if (c.kind === 'keyword_add') {
      op = { adGroupCriterionOperation: { create: { adGroup: prefix + '/adGroups/' + c.ad_group_id, status: 'ENABLED', keyword: { text: v.text, matchType: v.match_type } } } };
    } else if (c.kind === 'campaign_settings') {
      var upd = { resourceName: prefix + '/campaigns/' + c.campaign_id };
      var mask = [];
      if (v.geo_target_type) {
        upd.geoTargetTypeSetting = { positiveGeoTargetType: v.geo_target_type };
        mask.push('geo_target_type_setting.positive_geo_target_type');
      }
      if (typeof v.partner_network === 'boolean') {
        upd.networkSettings = { targetPartnerSearchNetwork: v.partner_network };
        mask.push('network_settings.target_partner_search_network');
      }
      if (!mask.length) return fail('Nada para mudar nesta campanha.');
      op = { campaignOperation: { update: upd, updateMask: mask.join(',') } };
    } else if (c.kind === 'conversion_goal') {
      op = { conversionActionOperation: { update: { resourceName: prefix + '/conversionActions/' + v.conversion_action_id, primaryForGoal: v.primary }, updateMask: 'primary_for_goal' } };
    } else if (c.kind === 'campaign_location') {
      return radarSetRadius_(prefix, c, fail);
    } else if (c.kind === 'mutate_batch') {
      return radarMutateBatch_(ctx, c, fail);
    } else {
      return fail('Tipo de alteração desconhecido: ' + c.kind);
    }
    var result = AdsApp.mutate(op);
    if (result.isSuccessful()) return { id: c.id, ok: true };
    return fail(radarErrors_(result));
  } catch (e) {
    return fail(String(e && e.message ? e.message : e));
  }
}

function radarErrors_(result) {
  var errors = result.getErrorMessages() || [];
  return errors.length ? errors.join(' | ') : 'O Google Ads recusou a alteração.';
}

// Replaces every positive city/radius of the campaign with one radius around a point. The radius is
// created first, so a failure never leaves the campaign without a location.
function radarSetRadius_(prefix, c, fail) {
  var v = c.value || {};
  var old = radarRows_(
    'SELECT campaign_criterion.resource_name FROM campaign_criterion WHERE campaign.id = ' + Number(c.campaign_id) +
    ' AND campaign_criterion.type IN (\'LOCATION\', \'PROXIMITY\') AND campaign_criterion.negative = FALSE',
    function (r) { return radarGet_(r, 'campaignCriterion.resourceName'); });
  var created = AdsApp.mutate({ campaignCriterionOperation: { create: {
    campaign: prefix + '/campaigns/' + c.campaign_id,
    proximity: { geoPoint: { latitudeInMicroDegrees: v.lat_micro, longitudeInMicroDegrees: v.lng_micro }, radius: v.radius_km, radiusUnits: 'KILOMETERS' }
  } } });
  if (!created.isSuccessful()) return fail(radarErrors_(created));
  var left = [];
  for (var i = 0; i < old.length; i++) {
    var removed = AdsApp.mutate({ campaignCriterionOperation: { remove: old[i] } });
    if (!removed.isSuccessful()) left.push(radarErrors_(removed));
  }
  if (left.length) return fail('Raio criado, mas ' + left.length + ' local(is) antigo(s) ficaram: ' + left.join(' | '));
  return { id: c.id, ok: true };
}

// Operations a creation batch may carry (a whole campaign: budget, campaign, locations, assets, asset
// group, signals, sitelinks, conversion goals). Anything else is refused.
var RADAR_BATCH_OPS = [
  'campaignBudgetOperation', 'campaignOperation', 'campaignCriterionOperation', 'assetOperation',
  'assetGroupOperation', 'assetGroupAssetOperation', 'assetGroupSignalOperation', 'campaignAssetOperation',
  'campaignConversionGoalOperation', 'customerConversionGoalOperation', 'adGroupOperation',
  'adGroupAdOperation', 'adGroupCriterionOperation'
];

// Applies a list of Google Ads operations in one all-or-nothing request. In the list, "{customer}" stands
// for this account and {"$fetch_base64": url} for the bytes of an image published on the site.
function radarMutateBatch_(ctx, c, fail) {
  var ops = (c.value || {}).operations || [];
  if (!ops.length) return fail('Nenhuma operação no lote.');
  for (var i = 0; i < ops.length; i++) {
    var keys = Object.keys(ops[i] || {});
    if (keys.length !== 1 || RADAR_BATCH_OPS.indexOf(keys[0]) < 0) return fail('Operação não permitida: ' + keys.join(','));
  }
  var results = AdsApp.mutateAll(radarFill_(ops, ctx.customerId), { partialFailure: false });
  var errors = [];
  for (var j = 0; j < results.length; j++) {
    if (!results[j].isSuccessful()) errors.push(radarErrors_(results[j]));
  }
  if (errors.length) return fail(errors.join(' | ').slice(0, 480));
  return { id: c.id, ok: true };
}

function radarFill_(node, customerId) {
  if (typeof node === 'string') return node.split('{customer}').join(customerId);
  if (Object.prototype.toString.call(node) === '[object Array]') {
    var list = [];
    for (var i = 0; i < node.length; i++) list.push(radarFill_(node[i], customerId));
    return list;
  }
  if (node && typeof node === 'object') {
    if (typeof node.$fetch_base64 === 'string') return radarImage_(node.$fetch_base64);
    var out = {};
    for (var k in node) {
      if (Object.prototype.hasOwnProperty.call(node, k)) out[k] = radarFill_(node[k], customerId);
    }
    return out;
  }
  return node;
}

function radarImage_(url) {
  if (!/^https:\/\/(www\.)?lancamento\.espontone\.com\.br\//.test(url)) throw new Error('Imagem fora do site: ' + url);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Imagem não baixou (' + res.getResponseCode() + '): ' + url);
  return Utilities.base64Encode(res.getContent());
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

// Reports for analysis (last COST_DAYS days): where people physically were (city and the most specific
// place), how each campaign is targeted, which conversion actions exist and which produced conversions.
// Each report fails alone (its error is sent instead); a failure here never stops the cost sync.
function radarSendReports_(ctx) {
  try {
    var from = radarAddDays_(ctx.today, -(RADAR.COST_DAYS - 1));
    var range = 'segments.date BETWEEN \'' + from + '\' AND \'' + ctx.today + '\'';
    var reports = [];
    var add = function (name, dated, build) {
      var r = { report: name, date_from: dated ? from : null, date_to: dated ? ctx.today : null, rows: [] };
      try {
        r.rows = build();
      } catch (e) {
        r.error = String(e && e.message ? e.message : e).slice(0, 500);
      }
      reports.push(r);
    };
    add('locations_city', true, function () { return radarLocations_(range, 'segments.geo_target_city', 'segments.geoTargetCity'); });
    add('locations_detail', true, function () {
      return radarLocations_(range, 'segments.geo_target_most_specific_location', 'segments.geoTargetMostSpecificLocation');
    });
    add('location_targets', false, radarLocationTargets_);
    add('conversion_actions', false, radarConversionActions_);
    add('conversions_by_action', true, function () { return radarConversionsByAction_(range); });
    add('keyword_quality', false, radarKeywordQuality_);
    add('campaign_serving', false, radarCampaignServing_);
    add('ads_review', false, radarAdsReview_);
    try {
      radarNameLocations_(reports);
    } catch (e) {
      Logger.log('Radar: nomes dos locais não foram encontrados (' + e + ').');
    }
    radarPost_(radarWith_(ctx.base, { reports: reports }));
    var summary = reports.map(function (r) { return r.report + ' ' + (r.error ? 'erro' : r.rows.length); }).join(', ');
    Logger.log('Radar: relatórios enviados (' + summary + ').');
  } catch (e) {
    Logger.log('Radar: relatórios de localização/conversões não foram enviados desta vez (' + e + ').');
  }
}

function radarMetrics_(r, row) {
  row.impressions = radarGet_(r, 'metrics.impressions') || 0;
  row.clicks = radarGet_(r, 'metrics.clicks') || 0;
  row.cost_micros = radarGet_(r, 'metrics.costMicros') || 0;
  row.conversions = radarGet_(r, 'metrics.conversions') || 0;
  return row;
}

function radarLocations_(range, field, path) {
  return radarRows_(
    'SELECT campaign.id, user_location_view.targeting_location, ' + field + ', ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
    'FROM user_location_view WHERE ' + range + ' AND metrics.impressions > 0',
    function (r) {
      return radarMetrics_(r, {
        campaign_id: String(radarGet_(r, 'campaign.id')),
        location: radarGet_(r, path),
        targeted: radarGet_(r, 'userLocationView.targetingLocation') === true
      });
    });
}

function radarLocationTargets_() {
  var rows = radarRows_(
    'SELECT campaign.id, campaign_criterion.type, campaign_criterion.negative, campaign_criterion.location.geo_target_constant, ' +
    'campaign_criterion.proximity.radius, campaign_criterion.proximity.radius_units, campaign_criterion.proximity.address.city_name, ' +
    'campaign_criterion.proximity.address.street_address, campaign_criterion.proximity.geo_point.latitude_in_micro_degrees, ' +
    'campaign_criterion.proximity.geo_point.longitude_in_micro_degrees FROM campaign_criterion ' +
    'WHERE campaign_criterion.type IN (\'LOCATION\', \'PROXIMITY\') AND campaign.status != \'REMOVED\'',
    function (r) {
      return {
        kind: 'criterion',
        campaign_id: String(radarGet_(r, 'campaign.id')),
        type: radarGet_(r, 'campaignCriterion.type'),
        negative: radarGet_(r, 'campaignCriterion.negative') === true,
        location: radarGet_(r, 'campaignCriterion.location.geoTargetConstant'),
        radius: radarGet_(r, 'campaignCriterion.proximity.radius'),
        radius_units: radarGet_(r, 'campaignCriterion.proximity.radiusUnits'),
        city: radarGet_(r, 'campaignCriterion.proximity.address.cityName'),
        street: radarGet_(r, 'campaignCriterion.proximity.address.streetAddress'),
        lat_micro: radarGet_(r, 'campaignCriterion.proximity.geoPoint.latitudeInMicroDegrees'),
        lng_micro: radarGet_(r, 'campaignCriterion.proximity.geoPoint.longitudeInMicroDegrees')
      };
    });
  try {
    rows = rows.concat(radarRows_(
      'SELECT campaign.id, campaign.geo_target_type_setting.positive_geo_target_type, ' +
      'campaign.network_settings.target_search_network, campaign.network_settings.target_partner_search_network, ' +
      'campaign.network_settings.target_content_network ' +
      'FROM campaign WHERE campaign.status != \'REMOVED\'',
      function (r) {
        return {
          kind: 'settings',
          campaign_id: String(radarGet_(r, 'campaign.id')),
          geo_target_type: radarGet_(r, 'campaign.geoTargetTypeSetting.positiveGeoTargetType'),
          search_network: radarGet_(r, 'campaign.networkSettings.targetSearchNetwork'),
          partner_network: radarGet_(r, 'campaign.networkSettings.targetPartnerSearchNetwork'),
          content_network: radarGet_(r, 'campaign.networkSettings.targetContentNetwork')
        };
      }));
  } catch (e) {
    rows.push({ kind: 'settings_error', error: String(e && e.message ? e.message : e).slice(0, 400) });
  }
  return rows;
}

function radarConversionActions_() {
  return radarRows_(
    'SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type, ' +
    'conversion_action.category, conversion_action.primary_for_goal, conversion_action.counting_type, ' +
    'conversion_action.include_in_conversions_metric FROM conversion_action WHERE conversion_action.status != \'REMOVED\'',
    function (r) {
      return {
        conversion_action_id: String(radarGet_(r, 'conversionAction.id')),
        name: radarGet_(r, 'conversionAction.name'),
        status: radarGet_(r, 'conversionAction.status'),
        type: radarGet_(r, 'conversionAction.type'),
        category: radarGet_(r, 'conversionAction.category'),
        primary_for_goal: radarGet_(r, 'conversionAction.primaryForGoal') === true,
        counting_type: radarGet_(r, 'conversionAction.countingType'),
        in_conversions: radarGet_(r, 'conversionAction.includeInConversionsMetric') === true
      };
    });
}

function radarConversionsByAction_(range) {
  return radarRows_(
    'SELECT segments.date, campaign.id, segments.conversion_action, segments.conversion_action_name, ' +
    'metrics.conversions, metrics.all_conversions FROM campaign WHERE ' + range + ' AND metrics.all_conversions > 0',
    function (r) {
      return {
        day: radarGet_(r, 'segments.date'),
        campaign_id: String(radarGet_(r, 'campaign.id')),
        conversion_action: radarGet_(r, 'segments.conversionAction'),
        conversion_action_name: radarGet_(r, 'segments.conversionActionName'),
        conversions: radarGet_(r, 'metrics.conversions') || 0,
        all_conversions: radarGet_(r, 'metrics.allConversions') || 0
      };
    });
}

// Adds location_name / location_canonical / location_type to every row that has a geoTargetConstants/ id.
// Why a keyword shows little: quality score parts and Google's serving status (active keywords only).
function radarKeywordQuality_() {
  return radarRows_(
    'SELECT campaign.id, ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ' +
    'ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, ' +
    'ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.post_click_quality_score, ' +
    'ad_group_criterion.quality_info.search_predicted_ctr, ad_group_criterion.system_serving_status, ' +
    'ad_group_criterion.approval_status FROM ad_group_criterion WHERE ad_group_criterion.type = \'KEYWORD\' ' +
    'AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = \'ENABLED\' AND campaign.status != \'REMOVED\'',
    function (r) {
      return {
        campaign_id: String(radarGet_(r, 'campaign.id')),
        ad_group_id: String(radarGet_(r, 'adGroup.id')),
        criterion_id: String(radarGet_(r, 'adGroupCriterion.criterionId')),
        keyword_text: radarGet_(r, 'adGroupCriterion.keyword.text'),
        match_type: radarGet_(r, 'adGroupCriterion.keyword.matchType'),
        quality_score: radarGet_(r, 'adGroupCriterion.qualityInfo.qualityScore'),
        creative_quality: radarGet_(r, 'adGroupCriterion.qualityInfo.creativeQualityScore'),
        landing_page_quality: radarGet_(r, 'adGroupCriterion.qualityInfo.postClickQualityScore'),
        predicted_ctr: radarGet_(r, 'adGroupCriterion.qualityInfo.searchPredictedCtr'),
        serving_status: radarGet_(r, 'adGroupCriterion.systemServingStatus'),
        approval_status: radarGet_(r, 'adGroupCriterion.approvalStatus')
      };
    });
}

// Why a campaign shows little: Google's status reasons and the share of searches lost (last 7 days).
// Two queries, each failing alone (a field this script version does not know only loses its rows).
function radarCampaignServing_() {
  var rows = [];
  var part = function (kind, build) {
    try {
      rows = rows.concat(build());
    } catch (e) {
      rows.push({ kind: kind + '_error', error: String(e && e.message ? e.message : e).slice(0, 400) });
    }
  };
  part('status', function () {
    return radarRows_(
      'SELECT campaign.id, campaign.primary_status, campaign.primary_status_reasons, campaign.serving_status ' +
      'FROM campaign WHERE campaign.status != \'REMOVED\'',
      function (r) {
        var reasons = radarGet_(r, 'campaign.primaryStatusReasons');
        return {
          kind: 'status',
          campaign_id: String(radarGet_(r, 'campaign.id')),
          primary_status: radarGet_(r, 'campaign.primaryStatus'),
          reasons: reasons && reasons.join ? reasons.join(',') : reasons,
          serving_status: radarGet_(r, 'campaign.servingStatus')
        };
      });
  });
  part('share', function () {
    return radarRows_(
      'SELECT campaign.id, metrics.impressions, metrics.search_impression_share, ' +
      'metrics.search_rank_lost_impression_share, metrics.search_budget_lost_impression_share ' +
      'FROM campaign WHERE segments.date DURING LAST_7_DAYS AND campaign.advertising_channel_type = \'SEARCH\'',
      function (r) {
        return {
          kind: 'share',
          campaign_id: String(radarGet_(r, 'campaign.id')),
          impressions: radarGet_(r, 'metrics.impressions') || 0,
          impression_share: radarGet_(r, 'metrics.searchImpressionShare'),
          rank_lost: radarGet_(r, 'metrics.searchRankLostImpressionShare'),
          budget_lost: radarGet_(r, 'metrics.searchBudgetLostImpressionShare')
        };
      });
  });
  return rows;
}

// Ad approval and strength (a disapproved or limited ad explains a campaign that stopped showing).
function radarAdsReview_() {
  return radarRows_(
    'SELECT campaign.id, ad_group.id, ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ' +
    'ad_group_ad.policy_summary.review_status, ad_group_ad.ad_strength, ad_group_ad.ad.final_urls ' +
    'FROM ad_group_ad WHERE ad_group_ad.status != \'REMOVED\' AND campaign.status != \'REMOVED\'',
    function (r) {
      var urls = radarGet_(r, 'adGroupAd.ad.finalUrls');
      return {
        campaign_id: String(radarGet_(r, 'campaign.id')),
        ad_group_id: String(radarGet_(r, 'adGroup.id')),
        ad_id: String(radarGet_(r, 'adGroupAd.ad.id')),
        status: radarGet_(r, 'adGroupAd.status'),
        approval_status: radarGet_(r, 'adGroupAd.policySummary.approvalStatus'),
        review_status: radarGet_(r, 'adGroupAd.policySummary.reviewStatus'),
        ad_strength: radarGet_(r, 'adGroupAd.adStrength'),
        final_url: urls && urls.length ? String(urls[0]).slice(0, 300) : null
      };
    });
}

function radarNameLocations_(reports) {
  var ids = {};
  reports.forEach(function (rep) {
    rep.rows.forEach(function (row) {
      if (typeof row.location === 'string' && row.location.indexOf('geoTargetConstants/') === 0) ids[row.location] = true;
    });
  });
  var list = Object.keys(ids);
  var names = {};
  for (var i = 0; i < list.length; i += 200) {
    var chunk = list.slice(i, i + 200).map(function (id) { return '\'' + id + '\''; }).join(', ');
    radarRows_(
      'SELECT geo_target_constant.resource_name, geo_target_constant.name, geo_target_constant.canonical_name, ' +
      'geo_target_constant.target_type FROM geo_target_constant WHERE geo_target_constant.resource_name IN (' + chunk + ')',
      function (r) {
        names[radarGet_(r, 'geoTargetConstant.resourceName')] = {
          name: radarGet_(r, 'geoTargetConstant.name'),
          canonical: radarGet_(r, 'geoTargetConstant.canonicalName'),
          type: radarGet_(r, 'geoTargetConstant.targetType')
        };
        return null;
      });
  }
  reports.forEach(function (rep) {
    rep.rows.forEach(function (row) {
      var n = names[row.location];
      if (!n) return;
      row.location_name = n.name;
      row.location_canonical = n.canonical;
      row.location_type = n.type;
    });
  });
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
