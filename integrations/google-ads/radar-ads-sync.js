/**
 * Radar — envia o custo do Google Ads para o painel (lancamento.espontone.com.br/painel/anuncios).
 *
 * Como instalar (uma vez):
 *   1. Google Ads → Ferramentas → Ações em massa → Scripts → botão "+" (novo script).
 *   2. Apague o que vier e cole este arquivo inteiro.
 *   3. Em RADAR.SECRET, troque o texto pela mesma chave cadastrada no Supabase (RADAR_ADS_SECRET).
 *   4. Clique em "Autorizar", depois em "Executar" uma vez e veja o registro: deve dizer "Radar: ok".
 *   5. Salve e defina a frequência "A cada hora".
 *
 * O que ele envia: custo, cliques, impressões e conversões por dia, por campanha e por
 * palavra-chave (últimos 30 dias, porque o Google ainda ajusta dias recentes) e o código de
 * cada clique (gclid) dos últimos 30 dias, para ligar cada lead à campanha exata.
 * Nenhum dado pessoal sai do Google Ads.
 */
var RADAR = {
  ENDPOINT: 'https://cnsmmwbqfbaimwexmtkx.supabase.co/functions/v1/ads-sync',
  SECRET: 'COLE_AQUI_A_CHAVE_DO_RADAR',
  COST_DAYS: 30,
  CLICK_DAYS: 30,
  CLICK_BATCH: 2000
};

function main() {
  if (!RADAR.SECRET || RADAR.SECRET.indexOf('COLE_AQUI') === 0) {
    throw new Error('Radar: cole a chave em RADAR.SECRET antes de executar.');
  }
  var account = AdsApp.currentAccount();
  var tz = account.getTimeZone();
  var base = {
    customer_id: String(account.getCustomerId()).replace(/-/g, ''),
    currency: account.getCurrencyCode(),
    time_zone: tz
  };
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var from = radarAddDays_(today, -(RADAR.COST_DAYS - 1));

  var stats = {
    date_from: from,
    date_to: today,
    campaigns: radarCampaigns_(from, today),
    keywords: radarKeywords_(from, today)
  };
  var res = radarPost_(radarWith_(base, { stats: stats }));
  Logger.log('Radar: custos de ' + from + ' a ' + today + ' enviados (' + res.campaigns + ' linhas de campanha, ' + res.keywords + ' de palavra-chave).');

  var clicks = [];
  for (var i = 0; i < RADAR.CLICK_DAYS; i++) {
    clicks = clicks.concat(radarClicks_(radarAddDays_(today, -i)));
  }
  for (var j = 0; j < clicks.length; j += RADAR.CLICK_BATCH) {
    radarPost_(radarWith_(base, { clicks: clicks.slice(j, j + RADAR.CLICK_BATCH) }));
  }
  Logger.log('Radar: ok. ' + clicks.length + ' cliques dos últimos ' + RADAR.CLICK_DAYS + ' dias enviados.');
}

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
