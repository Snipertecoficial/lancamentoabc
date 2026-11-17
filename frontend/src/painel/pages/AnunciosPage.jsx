import React, { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useEnv } from "../EnvContext";
import { PERIODS, periodRange, todaySP } from "../lib/period";
import { relativeTimeBR, formatDateTimeBR } from "../lib/format";
import { adsTotals, aggregateAdsCampaigns, aggregateAdsKeywords, matchTypeLabel } from "../lib/ads";
import { Panel, LoadError, Empty } from "./parts";
import { Segmented, periodText } from "./LeadsPage";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const CHUNK = 1000;
const KEYWORD_LIMIT = 100;
const CAMPAIGN_COLUMNS = "day,campaign_id,campaign_name,channel,impressions,clicks,cost,google_conversions,leads";
const KEYWORD_COLUMNS = "day,campaign_id,campaign_name,ad_group_id,ad_group_name,criterion_id,keyword_text,match_type,impressions,clicks,cost,google_conversions,leads";
const INITIAL = { period: "30d", from: "", to: "" };

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";
const control = `h-11 rounded-lg border border-white/10 bg-[#061224] px-3 text-[16px] text-[#E8EEF5] [color-scheme:dark] md:h-9 md:text-[13px] ${focusRing}`;
const numberFmt = new Intl.NumberFormat("pt-BR");
const decFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function moneyFmt(currency) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" });
  } catch (e) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  }
}

// All rows of a per-day ads view in the day range, 1000 at a time (PostgREST row cap).
async function fetchDaily(view, columns, order, range) {
  const all = [];
  for (let from = 0; ; from += CHUNK) {
    let q = supabase.from(view).select(columns).gte("day", range.fromDay).lte("day", range.toDay);
    order.forEach((col) => { q = q.order(col, { ascending: true }); });
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await q.range(from, from + CHUNK - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < CHUNK) break;
  }
  return all;
}

async function fetchLastSync() {
  const { data, error } = await supabase.from("ads_sync_runs")
    .select("received_at,customer_id,currency,time_zone").order("id", { ascending: false }).limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

/* ---------- pieces ---------- */

function Kpi({ label, value, hint, loading }) {
  return (
    <div className="bg-[#0A1930] px-3.5 py-3.5 md:px-4 md:py-4 lg:px-5 lg:py-5">
      {loading ? <Skeleton className="h-7 w-20 bg-white/[0.06] md:h-8" /> : (
        <p className="font-display text-[24px] font-semibold leading-none tabular-nums text-white lining-nums md:text-[28px] lg:text-[30px]">{value}</p>
      )}
      <p className="mt-2 text-[13px] font-medium leading-snug text-[#D5DBE2]">{label}</p>
      {hint && <p className="mt-0.5 text-[12px] leading-snug text-[#8E8E8E]">{hint}</p>}
    </div>
  );
}

function SyncStatus({ q }) {
  if (q.isPending) return null;
  if (q.isError) return <p className="text-[13px] text-[#8E8E8E]">Não foi possível ver a última sincronização.</p>;
  if (!q.data) return null;
  const at = q.data.received_at;
  const hours = (Date.now() - new Date(at).getTime()) / 3600000;
  return (
    <p className="text-[13px] text-[#8E8E8E]" title={formatDateTimeBR(at)}>
      <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${hours > 3 ? "bg-[#E8877E]" : "bg-[#4FD883]"}`} />
      {`Google Ads atualizado ${relativeTimeBR(at)}`}
      {hours > 3 && " · o script parou de enviar? Confira em Scripts no Google Ads."}
      {q.data.time_zone && q.data.time_zone !== "America/Sao_Paulo" && (
        <span className="text-[#E9CF93]">{` · A conta do Google Ads usa o fuso ${q.data.time_zone}; os dias podem não bater com os dos leads.`}</span>
      )}
    </p>
  );
}

function NotConnected() {
  return (
    <div className="px-4 py-10 lg:px-5">
      <p className="font-display text-[22px] text-white">O Google Ads ainda não enviou dados.</p>
      <ol className="mt-4 max-w-2xl list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-[#B8BEC5]">
        <li>No Supabase, cadastre o segredo <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[13px] text-[#E8EEF5]">RADAR_ADS_SECRET</code> nas Edge Functions.</li>
        <li>No Google Ads, em Ferramentas → Ações em massa → Scripts, cole o script do Radar com a mesma chave.</li>
        <li>Autorize, execute uma vez e deixe programado para rodar a cada hora.</li>
      </ol>
      <p className="mt-4 text-[13px] text-[#8E8E8E]">Assim que a primeira execução terminar, os custos aparecem aqui.</p>
    </div>
  );
}

const dash = "—";
// Leads but no cost in the period (the click came before it, or the keyword has no Google stats).
const cplText = (r, money) => (r.cpl !== null ? money.format(r.cpl) : r.leads > 0 ? "sem custo" : dash);
const keywordLabel = (k) => k.keyword_text || "Palavra-chave não identificada";
const campaignLabel = (c) => c.campaign_name || `Campanha ${c.campaign_id}`;

function CampaignsTable({ rows, money }) {
  const th = "h-10 px-3 text-[12px] font-medium text-[#8E8E8E] first:pl-5 last:pr-5";
  const td = "px-3 py-3 align-middle text-[13px] first:pl-5 last:pr-5";
  const num = `${td} text-right tabular-nums`;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/[0.06] hover:bg-transparent">
          <TableHead className={th}>Campanha</TableHead>
          <TableHead className={`${th} text-right`}>Investimento</TableHead>
          <TableHead className={`${th} text-right`}>Cliques</TableHead>
          <TableHead className={`${th} text-right`}>CPC</TableHead>
          <TableHead className={`${th} text-right`}>Leads</TableHead>
          <TableHead className={`${th} text-right`}>Custo por lead</TableHead>
          <TableHead className={`${th} text-right`}>Conv. no Google</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.campaign_id} className="border-white/[0.06] hover:bg-[#12294A]/30">
            <TableCell className={`${td} max-w-[300px] truncate text-[#E8EEF5]`} title={campaignLabel(c)}>{campaignLabel(c)}</TableCell>
            <TableCell className={`${num} text-white`}>{money.format(c.cost)}</TableCell>
            <TableCell className={`${num} text-[#B8BEC5]`}>{numberFmt.format(c.clicks)}</TableCell>
            <TableCell className={`${num} text-[#B8BEC5]`}>{c.cpc === null ? dash : money.format(c.cpc)}</TableCell>
            <TableCell className={`${num} font-semibold text-white`}>{numberFmt.format(c.leads)}</TableCell>
            <TableCell className={`${num} font-semibold text-[#9CC7EF]`}>{cplText(c, money)}</TableCell>
            <TableCell className={`${num} text-[#8E8E8E]`}>{decFmt.format(c.google_conversions)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function KeywordsTable({ rows, money }) {
  const th = "h-10 px-3 text-[12px] font-medium text-[#8E8E8E] first:pl-5 last:pr-5";
  const td = "px-3 py-3 align-middle text-[13px] first:pl-5 last:pr-5";
  const num = `${td} text-right tabular-nums`;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/[0.06] hover:bg-transparent">
          <TableHead className={th}>Palavra-chave</TableHead>
          <TableHead className={th}>Campanha</TableHead>
          <TableHead className={`${th} text-right`}>Investimento</TableHead>
          <TableHead className={`${th} text-right`}>Cliques</TableHead>
          <TableHead className={`${th} text-right`}>Leads</TableHead>
          <TableHead className={`${th} text-right`}>Custo por lead</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((k) => (
          <TableRow key={k.key} className="border-white/[0.06] hover:bg-[#12294A]/30">
            <TableCell className={`${td} max-w-[280px] truncate ${k.keyword_text ? "text-[#E8EEF5]" : "text-[#8E8E8E]"}`} title={keywordLabel(k)}>
              {keywordLabel(k)}
              {matchTypeLabel(k.match_type) && <span className="ml-2 text-[12px] text-[#8E8E8E]">{matchTypeLabel(k.match_type)}</span>}
            </TableCell>
            <TableCell className={`${td} max-w-[220px] truncate text-[#B8BEC5]`} title={campaignLabel(k)}>{campaignLabel(k)}</TableCell>
            <TableCell className={`${num} text-white`}>{money.format(k.cost)}</TableCell>
            <TableCell className={`${num} text-[#B8BEC5]`}>{numberFmt.format(k.clicks)}</TableCell>
            <TableCell className={`${num} font-semibold text-white`}>{numberFmt.format(k.leads)}</TableCell>
            <TableCell className={`${num} font-semibold text-[#9CC7EF]`}>{cplText(k, money)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Phones: one card per row, money first.
function Cards({ rows, money, title, subtitle }) {
  return (
    <ul className="divide-y divide-white/[0.06]">
      {rows.map((r) => (
        <li key={r.key || r.campaign_id} className="flex items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[15px] font-medium ${title(r).muted ? "text-[#8E8E8E]" : "text-white"}`}>{title(r).text}</p>
            {subtitle && <p className="mt-0.5 truncate text-[13px] text-[#8E8E8E]">{subtitle(r)}</p>}
            <p className="mt-1.5 text-[13px] tabular-nums text-[#B8BEC5]">
              {`${money.format(r.cost)} · ${numberFmt.format(r.clicks)} ${r.clicks === 1 ? "clique" : "cliques"}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-[22px] font-semibold leading-none tabular-nums text-white lining-nums">{numberFmt.format(r.leads)}</p>
            <p className="mt-1 text-[12px] text-[#8E8E8E]">{r.leads === 1 ? "lead" : "leads"}</p>
            <p className="mt-1 text-[12px] font-medium tabular-nums text-[#9CC7EF]">{r.cpl !== null ? `${money.format(r.cpl)}/lead` : r.leads > 0 ? "sem custo" : "sem lead"}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton({ what }) {
  return (
    <div aria-busy="true" className="space-y-3 px-4 pb-5 pt-4 lg:px-5">
      <span className="sr-only">{`Carregando ${what}…`}</span>
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 bg-white/[0.05]" />)}
    </div>
  );
}

/* ---------- page ---------- */

export default function AnunciosPage() {
  const { env } = useEnv();
  const [f, setF] = useState(INITIAL);
  const range = periodRange(f);
  const setFilter = (key, value) => setF((p) => (p[key] === value ? p : { ...p, [key]: value }));
  const choosePeriod = (period) => setF((p) => {
    if (p.period === period) return p;
    if (period !== "custom") return { ...p, period };
    return { ...p, period, from: p.from || range.fromDay, to: p.to || range.toDay };
  });

  const syncQ = useQuery({ queryKey: ["ads_sync_runs"], queryFn: fetchLastSync, refetchInterval: 5 * 60 * 1000 });
  const campaignsQ = useQuery({
    queryKey: ["panel_ads_campaigns_daily", range.fromDay, range.toDay],
    queryFn: async () => aggregateAdsCampaigns(await fetchDaily("panel_ads_campaigns_daily", CAMPAIGN_COLUMNS, ["day", "campaign_id"], range)),
    placeholderData: keepPreviousData,
  });
  const keywordsQ = useQuery({
    queryKey: ["panel_ads_keywords_daily", range.fromDay, range.toDay],
    queryFn: async () => aggregateAdsKeywords(await fetchDaily("panel_ads_keywords_daily", KEYWORD_COLUMNS, ["day", "campaign_id", "ad_group_id", "criterion_id"], range)),
    placeholderData: keepPreviousData,
  });

  const money = moneyFmt(syncQ.data && syncQ.data.currency);
  const campaigns = campaignsQ.data || [];
  const allKeywords = keywordsQ.data || [];
  const keywords = allKeywords.slice(0, KEYWORD_LIMIT);
  const totals = adsTotals(campaigns);
  const connected = !!syncQ.data;
  const stale = (q) => (q.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity");
  const loadingKpis = campaignsQ.isPending;

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h1 className="sr-only font-display text-[30px] font-semibold leading-tight tracking-tight text-white lg:not-sr-only lg:text-[34px]">Anúncios</h1>
          <p className="text-[14px] text-[#B8BEC5] lg:mt-1">
            {`${periodText(f, range)}, Google Ads e leads de produção.`}
            {env !== "production" && <span className="text-[#E9CF93]"> Esta tela sempre mostra produção.</span>}
          </p>
        </div>
        <SyncStatus q={syncQ} />
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2.5 md:mt-6">
        <div className="max-w-full overflow-x-auto">
          <Segmented label="Período" options={PERIODS} value={f.period} onChange={choosePeriod} />
        </div>
        {f.period === "custom" && (
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:flex md:w-auto">
            <input type="date" aria-label="De" value={f.from} max={f.to || todaySP()} onChange={(e) => setFilter("from", e.target.value)} className={`${control} w-full min-w-0 md:w-auto`} />
            <span aria-hidden="true" className="text-[14px] text-[#8E8E8E] md:text-[13px]">até</span>
            <input type="date" aria-label="Até" value={f.to} min={f.from || undefined} max={todaySP()} onChange={(e) => setFilter("to", e.target.value)} className={`${control} w-full min-w-0 md:w-auto`} />
          </div>
        )}
      </div>

      {!syncQ.isPending && !syncQ.isError && !connected ? (
        <Panel label="Conectar o Google Ads" title="Conectar o Google Ads" className="mt-4 md:mt-5"><NotConnected /></Panel>
      ) : (
        <>
          <section aria-label="Resumo do período" className={`mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] md:mt-5 md:grid-cols-3 xl:grid-cols-6 ${stale(campaignsQ)}`}>
            <Kpi loading={loadingKpis} label="Investimento" value={money.format(totals.cost)} />
            <Kpi loading={loadingKpis} label="Leads do Radar" value={numberFmt.format(totals.leads)} hint="Atribuídos a anúncios do Google" />
            <Kpi loading={loadingKpis} label="Custo por lead" value={totals.cpl === null ? dash : money.format(totals.cpl)} />
            <Kpi loading={loadingKpis} label="Cliques" value={numberFmt.format(totals.clicks)} hint={totals.ctr === null ? null : `CTR ${decFmt.format(totals.ctr)}%`} />
            <Kpi loading={loadingKpis} label="CPC médio" value={totals.cpc === null ? dash : money.format(totals.cpc)} />
            <Kpi loading={loadingKpis} label="Conversões no Google" value={decFmt.format(totals.google_conversions)} hint="O que o Google contou" />
          </section>

          <Panel
            label="Campanhas"
            title="Campanhas"
            className="mt-4 lg:mt-5"
            aside={campaigns.length > 0 && <p className="text-[13px] text-[#8E8E8E]">Mais investimento primeiro</p>}
          >
            {campaignsQ.isError && !campaignsQ.data ? (
              <LoadError what="as campanhas" onRetry={() => campaignsQ.refetch()} />
            ) : campaignsQ.isPending ? (
              <ListSkeleton what="as campanhas" />
            ) : campaigns.length === 0 ? (
              <Empty title="Nenhum gasto neste período.">Escolha um período maior.</Empty>
            ) : (
              <div className={`mt-2 ${stale(campaignsQ)}`}>
                <div className="hidden md:block"><CampaignsTable rows={campaigns} money={money} /></div>
                <div className="md:hidden">
                  <Cards rows={campaigns} money={money} title={(c) => ({ text: campaignLabel(c) })} />
                </div>
              </div>
            )}
          </Panel>

          <Panel
            label="Palavras-chave"
            title="Palavras-chave"
            className="mt-4 lg:mt-5"
            aside={allKeywords.length > 0 && <p className="text-[13px] text-[#8E8E8E]">Rede de pesquisa</p>}
          >
            {keywordsQ.isError && !keywordsQ.data ? (
              <LoadError what="as palavras-chave" onRetry={() => keywordsQ.refetch()} />
            ) : keywordsQ.isPending ? (
              <ListSkeleton what="as palavras-chave" />
            ) : keywords.length === 0 ? (
              <Empty title="Nenhuma palavra-chave neste período.">Campanhas sem palavra-chave (como Performance Max) aparecem só na tabela de campanhas.</Empty>
            ) : (
              <div className={`mt-2 ${stale(keywordsQ)}`}>
                <div className="hidden md:block"><KeywordsTable rows={keywords} money={money} /></div>
                <div className="md:hidden">
                  <Cards
                    rows={keywords}
                    money={money}
                    title={(k) => ({ text: keywordLabel(k), muted: !k.keyword_text })}
                    subtitle={(k) => [matchTypeLabel(k.match_type), campaignLabel(k)].filter(Boolean).join(" · ")}
                  />
                </div>
                {allKeywords.length > KEYWORD_LIMIT && (
                  <p className="border-t border-white/[0.06] px-4 py-3 text-[13px] text-[#8E8E8E] lg:px-5">
                    {`Mostrando as ${KEYWORD_LIMIT} com mais investimento de ${numberFmt.format(allKeywords.length)}.`}
                  </p>
                )}
              </div>
            )}
          </Panel>

          <p className="mt-4 text-[12px] leading-relaxed text-[#8E8E8E]">
            Leads do Radar são ligados à campanha pelo clique do anúncio (gclid). Sem ele, pelo código da campanha no link ou pelo nome da campanha.
          </p>
        </>
      )}
    </div>
  );
}
