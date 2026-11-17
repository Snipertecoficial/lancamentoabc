import React, { useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { RotateCw, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "../supabase";
import { useEnv, ENV_OPTIONS } from "../EnvContext";
import { useOverlay } from "../useOverlay";
import { PERIODS, periodRange, todaySP } from "../lib/period";
import { ORIGINS } from "../lib/origin";
import { sumFunnel, leadsPerDay, aggregateCampaigns } from "../lib/funnel";
import OriginBadge from "../OriginBadge";
import { Segmented, periodText } from "./LeadsPage";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const CHUNK = 1000;
const CAMPAIGN_LIMIT = 200;
const FUNNEL_COLUMNS = "day,origin,visits,watched_video,reached_form,started_form,submitted,thank_you,whatsapp";
const CAMPAIGN_COLUMNS = "day,origin,utm_campaign,keyword,visits,leads";
const INITIAL = { period: "7d", from: "", to: "", origin: "" };
const LOSS = "#E8877E";

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";
const control = `h-11 rounded-lg border border-white/10 bg-[#061224] px-3 text-[16px] text-[#E8EEF5] [color-scheme:dark] md:h-9 md:text-[13px] ${focusRing}`;
const numberFmt = new Intl.NumberFormat("pt-BR");
const pctFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const pct = (v) => `${pctFmt.format(v)}%`;

// All rows of a per-day view for the filter (env + day range + origin), 1000 at a time: a long
// custom period can pass the PostgREST row cap. `order` keeps the pages stable.
async function fetchDaily(view, columns, order, { env, origin, range }) {
  const all = [];
  for (let from = 0; ; from += CHUNK) {
    let q = supabase.from(view).select(columns).eq("env", env).gte("day", range.fromDay).lte("day", range.toDay);
    if (origin) q = q.eq("origin", origin);
    order.forEach((col) => { q = q.order(col, { ascending: true }); });
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await q.range(from, from + CHUNK - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < CHUNK) break;
  }
  return all;
}

const fetchFunnel = (args) => fetchDaily("panel_funnel_daily", FUNNEL_COLUMNS, ["day", "origin"], args);
const fetchCampaigns = async (args) => aggregateCampaigns(
  await fetchDaily("panel_campaigns_daily", CAMPAIGN_COLUMNS, ["day", "origin", "utm_campaign", "keyword"], args),
);

/* ---------- pieces ---------- */

function Panel({ label, title, aside, children, className = "" }) {
  return (
    <section aria-label={label} className={`overflow-hidden rounded-xl border border-white/[0.06] bg-[#061224]/50 ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-1 pt-4 lg:px-5 lg:pt-5">
        <h2 className="font-display text-[20px] font-semibold tracking-tight text-white lg:text-[22px]">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function LoadError({ what, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-4 py-8 lg:px-5">
      <p className="text-[15px] font-medium text-white">{`Não foi possível carregar ${what}.`}</p>
      <p className="text-[14px] text-[#B8BEC5]">Verifique a conexão e tente de novo.</p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        className={`h-11 rounded-lg border-white/15 bg-transparent text-[15px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white md:h-9 md:text-[13px] ${focusRing}`}
      >
        <RotateCw aria-hidden="true" />
        Tentar de novo
      </Button>
    </div>
  );
}

function Empty({ title, children }) {
  return (
    <div className="px-4 py-12 text-center lg:px-5">
      <p className="font-display text-[20px] text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[14px] text-[#B8BEC5]">{children}</p>
    </div>
  );
}

// Each step: name and count, a bar sized by % of visits, and above it how many were lost on the way
// from the previous step. The largest loss is the one to look at first.
function Funnel({ funnel }) {
  return (
    <ol className="px-4 pb-5 pt-3 lg:px-5">
      {funnel.steps.map((s, i) => {
        const biggest = funnel.biggestDrop === s.key;
        const prev = i > 0 ? funnel.steps[i - 1].count : 0;
        const width = s.pctOfVisits === null ? 0 : Math.max(s.pctOfVisits, s.count > 0 ? 0.6 : 0);
        return (
          <li key={s.key} data-step={s.key} data-biggest={biggest ? "true" : undefined}>
            {i > 0 && (
              <div className={`flex items-center gap-2 py-1.5 pl-3 text-[12px] ${biggest ? "" : "text-[#8E8E8E]"}`} style={biggest ? { color: LOSS } : undefined}>
                <span aria-hidden="true" className="h-4 w-px" style={{ background: biggest ? LOSS : "rgba(255,255,255,0.15)" }} />
                {s.dropPct === null ? (
                  <span>—</span>
                ) : s.dropPct > 0 ? (
                  <span className="tabular-nums">
                    <span className="font-semibold">{`−${pct(s.dropPct)}`}</span>
                    {`, ${numberFmt.format(prev - s.count)} ${prev - s.count === 1 ? "parou" : "pararam"} aqui`}
                  </span>
                ) : (
                  <span className="tabular-nums">sem perda</span>
                )}
                {biggest && (
                  <span className="whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-semibold" style={{ borderColor: `${LOSS}55`, background: `${LOSS}1A` }}>
                    Maior perda
                  </span>
                )}
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] font-medium text-[#E8EEF5]">{s.label}</span>
              <span className="shrink-0 font-display text-[20px] font-semibold leading-none tabular-nums text-white lining-nums">{numberFmt.format(s.count)}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.05]" aria-hidden="true">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(width, 100)}%`, background: i === 0 ? "#3A70A3" : s.key === "whatsapp" ? "#4FD883" : "#5B95CE" }}
              />
            </div>
            <p className="mt-1 text-[12px] tabular-nums text-[#8E8E8E]">
              {i === 0 ? "Pessoas que abriram a página" : s.pctOfVisits === null ? "—" : `${pct(s.pctOfVisits)} das visitas`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function FunnelSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5 px-4 pb-5 pt-4 lg:px-5">
      <span className="sr-only">Carregando o funil…</span>
      {[100, 70, 45, 30, 18, 14, 9].map((w) => (
        <div key={w}>
          <Skeleton className="h-4 w-36 bg-white/[0.06]" />
          <Skeleton className="mt-2 h-2.5 bg-white/[0.05]" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

function ChartTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#061224] px-3 py-2 text-[13px] text-[#E8EEF5] shadow-xl">
      <p className="text-[#8E8E8E]">{p.label}</p>
      <p className="font-medium tabular-nums">{p.leads === 1 ? "1 lead" : `${numberFmt.format(p.leads)} leads`}</p>
    </div>
  );
}

function LeadsChart({ days }) {
  const total = days.reduce((a, d) => a + d.leads, 0);
  const best = days.reduce((m, d) => (d.leads > m.leads ? d : m), days[0]);
  return (
    <div className="px-2 pb-4 pt-3 lg:px-3">
      <p className="sr-only">
        {`${numberFmt.format(total)} leads no período.${best && best.leads ? ` Dia com mais leads: ${best.label}, com ${best.leads}.` : ""}`}
      </p>
      <div aria-hidden="true" className="h-[200px] lg:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#8E8E8E", fontSize: 12 }} interval="preserveStartEnd" minTickGap={14} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#8E8E8E", fontSize: 12 }} width={30} />
            <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(125,180,232,0.08)" }} />
            <Bar dataKey="leads" fill="#5B95CE" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const campaignName = (c) => c.utm_campaign || "Sem campanha";
const conversion = (c) => (c.conversion_pct === null || c.conversion_pct === undefined ? "—" : pct(Number(c.conversion_pct)));

function CampaignsTable({ rows }) {
  const th = "h-10 px-3 text-[12px] font-medium text-[#8E8E8E] first:pl-5 last:pr-5";
  const td = "px-3 py-3 align-middle text-[13px] first:pl-5 last:pr-5";
  const num = `${td} text-right tabular-nums`;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/[0.06] hover:bg-transparent">
          <TableHead className={th}>Origem</TableHead>
          <TableHead className={th}>Campanha</TableHead>
          <TableHead className={th}>Palavra-chave</TableHead>
          <TableHead className={`${th} text-right`}>Visitas</TableHead>
          <TableHead className={`${th} text-right`}>Leads</TableHead>
          <TableHead className={`${th} text-right`}>Conversão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c, i) => (
          <TableRow key={`${c.origin}|${c.utm_campaign}|${c.keyword}|${i}`} className="border-white/[0.06] hover:bg-[#12294A]/30">
            <TableCell className={td}><OriginBadge origin={c.origin} /></TableCell>
            <TableCell className={`${td} max-w-[280px] truncate ${c.utm_campaign ? "text-[#E8EEF5]" : "text-[#8E8E8E]"}`} title={campaignName(c)}>{campaignName(c)}</TableCell>
            <TableCell className={`${td} max-w-[240px] truncate text-[#B8BEC5]`} title={c.keyword || ""}>{c.keyword || "—"}</TableCell>
            <TableCell className={`${num} text-[#B8BEC5]`}>{numberFmt.format(Number(c.visits) || 0)}</TableCell>
            <TableCell className={`${num} font-semibold text-white`}>{numberFmt.format(Number(c.leads) || 0)}</TableCell>
            <TableCell className={`${num} text-[#D5DBE2]`}>{conversion(c)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CampaignCards({ rows }) {
  return (
    <ul className="divide-y divide-white/[0.06]">
      {rows.map((c, i) => (
        <li key={`${c.origin}|${c.utm_campaign}|${c.keyword}|${i}`} className="flex items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[15px] font-medium ${c.utm_campaign ? "text-white" : "text-[#8E8E8E]"}`}>{campaignName(c)}</p>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <OriginBadge origin={c.origin} />
              {c.keyword && <span className="min-w-0 truncate text-[13px] text-[#8E8E8E]">{c.keyword}</span>}
            </div>
            <p className="mt-1.5 text-[13px] tabular-nums text-[#8E8E8E]">
              {`${numberFmt.format(Number(c.visits) || 0)} visitas, ${conversion(c)} viraram lead`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-[24px] font-semibold leading-none tabular-nums text-white lining-nums">{numberFmt.format(Number(c.leads) || 0)}</p>
            <p className="mt-1 text-[12px] text-[#8E8E8E]">{Number(c.leads) === 1 ? "lead" : "leads"}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- page ---------- */

export default function FunilPage() {
  const { env } = useEnv();
  const [f, setF] = useState(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheet = useRef(null);
  const sheetClose = useRef(null);
  const sheetTrigger = useRef(null);

  useOverlay({
    open: sheetOpen,
    onClose: () => setSheetOpen(false),
    containerRef: sheet,
    initialFocusRef: sheetClose,
    returnFocusRef: sheetTrigger,
    closeAtQuery: "(min-width: 768px)",
  });

  const range = periodRange(f);
  const setFilter = (key, value) => setF((p) => (p[key] === value ? p : { ...p, [key]: value }));
  const choosePeriod = (period) => setF((p) => {
    if (p.period === period) return p;
    if (period !== "custom") return { ...p, period };
    return { ...p, period, from: p.from || range.fromDay, to: p.to || range.toDay };
  });
  const sheetCount = (f.period !== INITIAL.period ? 1 : 0) + (f.origin ? 1 : 0);
  const resetSheet = () => setF(INITIAL);

  const funnelQ = useQuery({
    queryKey: ["panel_funnel_daily", env, f.origin, range.fromDay, range.toDay],
    queryFn: () => fetchFunnel({ env, origin: f.origin, range }),
    placeholderData: keepPreviousData,
  });
  const campaignsQ = useQuery({
    queryKey: ["panel_campaigns_daily", env, f.origin, range.fromDay, range.toDay],
    queryFn: () => fetchCampaigns({ env, origin: f.origin, range }),
    placeholderData: keepPreviousData,
  });

  const rows = funnelQ.data || [];
  const funnel = sumFunnel(rows);
  const days = leadsPerDay(rows, range.fromDay, range.toDay);
  const leads = funnel.steps.find((s) => s.key === "submitted").count;
  const allCampaigns = campaignsQ.data || [];
  const campaigns = allCampaigns.slice(0, CAMPAIGN_LIMIT);
  const envLabel = (ENV_OPTIONS.find((o) => o.value === env) || ENV_OPTIONS[0]).label.toLowerCase();
  const originText = f.origin ? `, ${(ORIGINS.find((o) => o.value === f.origin) || {}).label}` : "";
  const stale = (q) => (q.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity");

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="flex items-center justify-between gap-3 md:flex-wrap md:items-end md:gap-4">
        <div className="min-w-0">
          <h1 className="sr-only font-display text-[30px] font-semibold leading-tight tracking-tight text-white lg:not-sr-only lg:text-[34px]">Funil & Campanhas</h1>
          <p className="text-[14px] text-[#B8BEC5] lg:mt-1">{`${periodText(f, range)}${originText}, dados de ${envLabel}.`}</p>
        </div>
        <button
          ref={sheetTrigger}
          type="button"
          aria-expanded={sheetOpen}
          aria-controls="filtros-funil"
          onClick={() => setSheetOpen(true)}
          className={`relative flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-[15px] font-medium transition-colors md:hidden ${focusRing} ${
            sheetCount ? "border-[#7DB4E8]/50 bg-[#12294A] text-white" : "border-white/10 bg-[#061224] text-[#E8EEF5]"
          }`}
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
          Filtros
          {sheetCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7DB4E8] px-1.5 text-[12px] font-semibold tabular-nums text-[#061224]">
              <span className="sr-only">, ativos: </span>
              {sheetCount}
            </span>
          )}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2.5 md:mt-6">
        {sheetOpen && (
          <button
            type="button"
            aria-label="Fechar filtros"
            tabIndex={-1}
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-40 bg-[#061224]/70 backdrop-blur-sm duration-200 animate-in fade-in motion-reduce:animate-none md:hidden"
          />
        )}
        {/* Same controls as a bottom sheet on phones and inline from md up (md:contents). */}
        <div
          ref={sheet}
          id="filtros-funil"
          role={sheetOpen ? "dialog" : undefined}
          aria-modal={sheetOpen ? "true" : undefined}
          aria-label={sheetOpen ? "Filtros" : undefined}
          className={`${sheetOpen ? "fixed inset-x-0 bottom-0 z-50 flex duration-300 animate-in slide-in-from-bottom motion-reduce:animate-none" : "hidden"} max-h-[88dvh] flex-col rounded-t-2xl border-t border-white/10 bg-[#0A1930] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] md:contents`}
        >
          <div className="flex shrink-0 items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 md:hidden">
            <h2 className="font-display text-[22px] font-semibold text-white">Filtros</h2>
            <button
              ref={sheetClose}
              type="button"
              aria-label="Fechar filtros"
              onClick={() => setSheetOpen(false)}
              className={`flex h-11 w-11 items-center justify-center rounded-lg text-[#B8BEC5] hover:text-white ${focusRing}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-[max(1rem,env(safe-area-inset-left))] pb-5 pt-3 md:contents">
            <div className="flex flex-col gap-2 md:contents">
              <p aria-hidden="true" className="text-[13px] text-[#8E8E8E] md:hidden">Período</p>
              <div className="max-w-full overflow-x-auto">
                <Segmented label="Período" options={PERIODS} value={f.period} onChange={choosePeriod} />
              </div>
              {f.period === "custom" && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:flex">
                  <input type="date" aria-label="De" value={f.from} max={f.to || todaySP()} onChange={(e) => setFilter("from", e.target.value)} className={`${control} w-full min-w-0 md:w-auto`} />
                  <span aria-hidden="true" className="text-[14px] text-[#8E8E8E] md:text-[13px]">até</span>
                  <input type="date" aria-label="Até" value={f.to} min={f.from || undefined} max={todaySP()} onChange={(e) => setFilter("to", e.target.value)} className={`${control} w-full min-w-0 md:w-auto`} />
                </div>
              )}
            </div>
            <label className="flex flex-col gap-2 md:contents">
              <span className="text-[13px] text-[#8E8E8E] md:hidden">Origem</span>
              <select aria-label="Origem" value={f.origin} onChange={(e) => setFilter("origin", e.target.value)} className={control}>
                <option value="">Todas as origens</option>
                {ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2.5 border-t border-white/[0.06] px-[max(1rem,env(safe-area-inset-left))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:hidden">
            <Button
              type="button"
              variant="ghost"
              onClick={resetSheet}
              disabled={!sheetCount}
              className={`h-12 rounded-lg px-4 text-[15px] text-[#B8BEC5] hover:bg-white/[0.04] hover:text-white ${focusRing}`}
            >
              Limpar
            </Button>
            <Button
              type="button"
              onClick={() => setSheetOpen(false)}
              className={`h-12 rounded-lg bg-[#7DB4E8] text-[15px] font-semibold text-[#061224] hover:bg-[#9CC7EF] ${focusRing}`}
            >
              Ver funil
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:mt-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-5">
        <Panel
          label="Funil do período"
          title="Funil"
          aside={funnel.visits > 0 && (
            <p className="text-[13px] tabular-nums text-[#B8BEC5]">
              {`${numberFmt.format(funnel.visits)} visitas, ${numberFmt.format(leads)} ${leads === 1 ? "lead" : "leads"} (${pct((leads / funnel.visits) * 100)})`}
            </p>
          )}
        >
          {funnelQ.isError && !funnelQ.data ? (
            <LoadError what="o funil" onRetry={() => funnelQ.refetch()} />
          ) : funnelQ.isPending ? (
            <FunnelSkeleton />
          ) : funnel.visits === 0 ? (
            <Empty title="Nenhuma visita neste período.">
              {f.origin ? "Escolha outra origem ou um período maior." : "Escolha um período maior para ver o funil."}
            </Empty>
          ) : (
            <div aria-busy={funnelQ.isFetching} className={stale(funnelQ)}><Funnel funnel={funnel} /></div>
          )}
        </Panel>

        <Panel
          label="Leads por dia"
          title="Leads por dia"
          aside={!funnelQ.isPending && !funnelQ.isError && <p className="text-[13px] text-[#8E8E8E]">Formulários enviados</p>}
        >
          {funnelQ.isError && !funnelQ.data ? (
            <p className="px-4 py-8 text-[14px] text-[#8E8E8E] lg:px-5">Sem dados enquanto o funil não carrega.</p>
          ) : funnelQ.isPending ? (
            <div aria-busy="true" className="px-4 pb-5 pt-4 lg:px-5"><Skeleton className="h-[200px] bg-white/[0.04] lg:h-[260px]" /></div>
          ) : (
            <div className={stale(funnelQ)}><LeadsChart days={days} /></div>
          )}
        </Panel>
      </div>

      <Panel
        label="Campanhas"
        title="Campanhas"
        className="mt-4 lg:mt-5"
        aside={allCampaigns.length > 0 && <p className="text-[13px] text-[#8E8E8E]">No mesmo período e origem do funil</p>}
      >
        {campaignsQ.isError && !campaignsQ.data ? (
          <LoadError what="as campanhas" onRetry={() => campaignsQ.refetch()} />
        ) : campaignsQ.isPending ? (
          <div aria-busy="true" className="space-y-3 px-4 pb-5 pt-4 lg:px-5">
            <span className="sr-only">Carregando as campanhas…</span>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 bg-white/[0.05]" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <Empty title="Nenhuma campanha neste período.">
            {f.origin ? "Escolha outra origem ou um período maior." : "Escolha um período maior para ver as campanhas."}
          </Empty>
        ) : (
          <div className={`mt-2 ${stale(campaignsQ)}`}>
            <div className="hidden md:block"><CampaignsTable rows={campaigns} /></div>
            <div className="md:hidden"><CampaignCards rows={campaigns} /></div>
            {allCampaigns.length > CAMPAIGN_LIMIT && (
              <p className="border-t border-white/[0.06] px-4 py-3 text-[13px] text-[#8E8E8E] lg:px-5">
                {`Mostrando as ${CAMPAIGN_LIMIT} com mais leads de ${numberFmt.format(allCampaigns.length)}.`}
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
