import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, MessageCircle, RotateCw, Search, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "../supabase";
import { useEnv, ENV_OPTIONS } from "../EnvContext";
import { useScrollLock } from "../useScrollLock";
import { PERIODS, periodRange, todaySP } from "../lib/period";
import { applyLeadFilters } from "../lib/query";
import { ORIGINS, AD_ORIGINS, originLabel, originTone } from "../lib/origin";
import { STAGES, stageInfo, temperatureInfo } from "../lib/stage";
import { toCSV, downloadCSV } from "../lib/csv";
import {
  formatPhoneBR, waLink, formatDateTimeBR, formatShortDateTimeBR, formatTimeBR, formatDateBR, relativeTimeBR,
} from "../lib/format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 50;
const CHUNK = 1000;
const LIST_COLUMNS =
  "id,name,phone_e164,email,created_at,submitted_at,rd_confirmed_at,thank_you_at,whatsapp_at,stage,origin,utm_campaign,keyword,utm_term,temperature,last_event_at";
const CSV_SELECT =
  "id,name,phone_e164,email,created_at,stage,submitted_at,rd_confirmed_at,thank_you_at,whatsapp_at,origin,utm_source,utm_medium,utm_campaign,keyword,utm_term,device,landing_url,referrer,temperature,visits,last_event_at";
const CSV_COLUMNS = [
  { label: "ID", value: (r) => r.id },
  { label: "Nome", value: (r) => r.name },
  { label: "WhatsApp", value: (r) => formatPhoneBR(r.phone_e164) },
  { label: "E-mail", value: (r) => r.email },
  { label: "Chegou em", value: (r) => formatDateTimeBR(r.created_at) },
  { label: "Estágio", value: (r) => stageInfo(r.stage).label },
  ...STAGES.map((s) => ({ label: s.label, value: (r) => formatDateTimeBR(s.at(r)) })),
  { label: "Origem", value: (r) => originLabel(r.origin) },
  { label: "Fonte (utm_source)", value: (r) => r.utm_source },
  { label: "Mídia (utm_medium)", value: (r) => r.utm_medium },
  { label: "Campanha", value: (r) => r.utm_campaign },
  { label: "Palavra-chave", value: (r) => r.keyword },
  { label: "Termo (utm_term)", value: (r) => r.utm_term },
  { label: "Dispositivo", value: (r) => r.device },
  { label: "Página de entrada", value: (r) => r.landing_url },
  { label: "Referência", value: (r) => r.referrer },
  { label: "Temperatura", value: (r) => temperatureInfo(r.temperature).label },
  { label: "Visitas", value: (r) => r.visits },
  { label: "Última atividade", value: (r) => formatDateTimeBR(r.last_event_at) },
];

const INITIAL = { period: "7d", from: "", to: "", origin: "", stage: "", search: "", page: 0 };
const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";
const control = `h-11 rounded-lg border border-white/10 bg-[#061224] px-3 text-[16px] text-[#E8EEF5] [color-scheme:dark] md:h-9 md:text-[13px] ${focusRing}`;
const numberFmt = new Intl.NumberFormat("pt-BR");
const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function periodText(filters, range) {
  if (filters.period === "hoje") return "Hoje";
  if (filters.period === "30d") return "Últimos 30 dias";
  if (filters.period === "7d") return "Últimos 7 dias";
  const d = (ymd) => ymd.split("-").reverse().join("/");
  return range.fromDay === range.toDay ? `Em ${d(range.fromDay)}` : `De ${d(range.fromDay)} a ${d(range.toDay)}`;
}

// Time of a milestone: just the hour when it happened today, otherwise day and hour.
function when(iso) {
  if (!iso) return "";
  return formatDateBR(iso) === formatDateBR(new Date().toISOString()) ? formatTimeBR(iso) : formatShortDateTimeBR(iso);
}

// "Chegou há 5 min" for recent leads, "Chegou em 02/10/2026" once the relative time turns into a date.
// On the narrowest phones only the time shows (the words stay for screen readers).
function Arrived({ iso }) {
  const rel = relativeTimeBR(iso);
  if (!rel) return null;
  return (
    <>
      <span className="max-[379px]:sr-only">{/^(há|agora)/.test(rel) ? "Chegou " : "Chegou em "}</span>
      {rel}
    </>
  );
}

async function fetchKpis({ env, range }) {
  const base = () => supabase.from("panel_leads").select("id", { count: "exact", head: true })
    .eq("env", env).gte("created_at", range.fromIso).lt("created_at", range.toIso);
  const [total, ads, whatsapp, funnel] = await Promise.all([
    base(),
    base().in("origin", AD_ORIGINS),
    base().not("whatsapp_at", "is", null),
    supabase.from("panel_funnel_daily").select("visits,submitted")
      .eq("env", env).gte("day", range.fromDay).lte("day", range.toDay),
  ]);
  const failed = [total, ads, whatsapp, funnel].find((r) => r.error);
  if (failed) throw failed.error;
  const sum = (k) => (funnel.data || []).reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
  return { total: total.count || 0, ads: ads.count || 0, whatsapp: whatsapp.count || 0, visits: sum("visits"), submitted: sum("submitted") };
}

/* ---------- pieces ---------- */

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-0.5 rounded-lg border border-white/10 bg-[#061224] p-0.5 md:flex md:gap-0">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-11 whitespace-nowrap rounded-md px-3 text-[15px] font-medium transition-colors md:h-8 md:text-[13px] ${focusRing} ${
              on ? "bg-[#12294A] text-white shadow-[inset_0_0_0_1px_rgba(125,180,232,0.35)]" : "text-[#8E8E8E] hover:text-[#E8EEF5]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Kpi({ value, label, hint, loading }) {
  return (
    <div className="bg-[#0A1930] px-3.5 py-3.5 md:px-4 md:py-4 lg:px-5 lg:py-5">
      {loading ? <Skeleton className="h-7 w-14 bg-white/[0.06] md:h-8 md:w-16" /> : (
        <p className="font-display text-[27px] font-semibold leading-none tabular-nums text-white md:text-[32px] lg:text-[36px]">{value}</p>
      )}
      <p className="mt-2 text-[13px] font-medium leading-snug text-[#D5DBE2] md:mt-2.5">{label}</p>
      <p className="mt-0.5 min-h-[18px] text-[12px] leading-snug text-[#8E8E8E]">{loading ? "" : hint}</p>
    </div>
  );
}

function KpiStrip({ query }) {
  const k = query.data;
  const loading = query.isPending;
  const share = (n) => (k && k.total ? `${Math.round((n / k.total) * 100)}% dos leads` : "");
  const rate = k && k.visits ? `${pctFmt.format((k.submitted / k.visits) * 100)}%` : "—";
  const n = (v) => (k ? numberFmt.format(v) : "—");
  return (
    <section aria-label="Indicadores do período">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] lg:grid-cols-4">
        <Kpi loading={loading} value={n(k && k.total)} label="Leads no período" hint="Formulários enviados" />
        <Kpi loading={loading} value={n(k && k.ads)} label="Leads de anúncios" hint={share(k && k.ads) || "Google Ads e Meta Ads"} />
        <Kpi loading={loading} value={n(k && k.whatsapp)} label="Chegaram ao WhatsApp" hint={share(k && k.whatsapp)} />
        <Kpi
          loading={loading}
          value={rate}
          label="Taxa visita→lead"
          hint={k ? `${numberFmt.format(k.submitted)} de ${numberFmt.format(k.visits)} visitas` : ""}
        />
      </div>
      {query.isError && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-[13px] text-[#F4B4B4]">
          Não foi possível carregar os indicadores.
          <button type="button" onClick={() => query.refetch()} className={`rounded text-[#7DB4E8] underline-offset-2 hover:underline ${focusRing}`}>
            Tentar de novo
          </button>
        </p>
      )}
    </section>
  );
}

function OriginCell({ lead, inline = false }) {
  const detail = [lead.utm_campaign, lead.keyword || lead.utm_term].filter(Boolean).join(" · ");
  return (
    <div className={inline ? "flex min-w-0 items-center gap-2" : "min-w-0"}>
      <Badge variant="outline" className="shrink-0 gap-1.5 rounded-md border-white/10 bg-white/[0.03] px-2 py-0.5 text-[12px] font-medium text-[#E8EEF5] shadow-none">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: originTone(lead.origin) }} />
        {originLabel(lead.origin)}
      </Badge>
      {detail && (
        <p className={inline ? "min-w-0 flex-1 truncate text-[13px] text-[#8E8E8E]" : "mt-1 max-w-[240px] truncate text-[12px] text-[#8E8E8E]"} title={detail}>
          {detail}
        </p>
      )}
    </div>
  );
}

// Four milestones as a rail (filled = happened), then a chip with the furthest one and its time.
function StageTrack({ lead, wrap = false }) {
  const current = stageInfo(lead.stage);
  const at = current.at(lead);
  return (
    <div className={`flex items-center gap-2.5 ${wrap ? "flex-wrap gap-y-1.5" : ""}`}>
      <ol aria-label="Etapas do lead" className="flex shrink-0 items-center">
        {STAGES.map((s, i) => {
          const t = s.at(lead);
          const isCurrent = s.value === current.value;
          return (
            <li key={s.value} className="flex items-center" title={`${s.label}: ${t ? formatDateTimeBR(t) : "ainda não"}`}>
              {i > 0 && <span aria-hidden="true" className={`h-px w-2.5 ${t ? "bg-[#5B95CE]/70" : "bg-white/15"}`} />}
              <span
                aria-hidden="true"
                className={`block h-2 w-2 rounded-full ${t ? "" : "border border-white/25"}`}
                style={t ? { background: isCurrent ? current.color : "#5B95CE", boxShadow: isCurrent ? `0 0 0 3px ${current.color}33` : undefined } : undefined}
              />
              <span className="sr-only">{`${s.label}: ${t ? formatDateTimeBR(t) : "ainda não"}`}</span>
            </li>
          );
        })}
      </ol>
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium"
        style={{ borderColor: `${current.color}40`, background: `${current.color}14`, color: current.color }}
      >
        {current.label}
        {at && <span className="tabular-nums opacity-80">{when(at)}</span>}
      </span>
    </div>
  );
}

export function Temperature({ value, pill = false }) {
  const t = temperatureInfo(value);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 text-[13px] font-medium ${pill ? "h-7 rounded-full border px-2.5" : ""}`}
      style={pill ? { color: t.color, borderColor: `${t.color}40`, background: `${t.color}14` } : { color: t.color }}
    >
      <span aria-hidden="true" className="flex items-end gap-[2px]">
        {[1, 2, 3].map((lvl) => (
          <span key={lvl} className="w-[3px] rounded-sm" style={{ height: 4 + lvl * 3, background: lvl <= t.level ? t.color : "rgba(255,255,255,0.14)" }} />
        ))}
      </span>
      {t.label}
    </span>
  );
}

function WhatsAppButton({ phone }) {
  const href = waLink(phone);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir conversa no WhatsApp com ${formatPhoneBR(phone)}`}
      title="Abrir conversa no WhatsApp"
      className={`inline-flex h-9 w-9 shrink-0 md:h-7 md:w-7 items-center justify-center rounded-md border border-[#25D366]/30 bg-[#25D366]/10 text-[#4FD883] transition-colors hover:bg-[#25D366]/20 ${focusRing}`}
    >
      <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
    </a>
  );
}

function useOpenLead() {
  const navigate = useNavigate();
  return (e, id) => {
    // Links and buttons inside the row keep their own behavior; selecting text does not navigate.
    if (e.target.closest && e.target.closest("a,button")) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length > 0) return;
    navigate(`/painel/leads/${id}`);
  };
}

function LeadsTable({ rows, onOpen }) {
  const th = "h-10 px-3 text-[12px] font-medium text-[#8E8E8E] first:pl-5 last:pr-5";
  const td = "px-3 py-3 align-middle first:pl-5 last:pr-5";
  return (
    <Table className="min-w-[1040px]">
      <TableHeader>
        <TableRow className="border-white/[0.06] hover:bg-transparent">
          <TableHead className={th}>Nome</TableHead>
          <TableHead className={th}>WhatsApp</TableHead>
          <TableHead className={th}>Origem</TableHead>
          <TableHead className={th}>Estágio</TableHead>
          <TableHead className={th}>Temperatura</TableHead>
          <TableHead className={th}>Chegou em</TableHead>
          <TableHead className={th}>Última atividade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((l) => (
          <TableRow key={l.id} onClick={(e) => onOpen(e, l.id)} className="cursor-pointer border-white/[0.06] hover:bg-[#12294A]/45">
            <TableCell className={`${td} max-w-[220px]`}>
              <Link to={`/painel/leads/${l.id}`} className={`block truncate rounded text-[14px] font-medium text-white hover:text-[#7DB4E8] ${focusRing}`}>
                {l.name || "Sem nome"}
              </Link>
              {l.email && <p className="truncate text-[12px] text-[#8E8E8E]" title={l.email}>{l.email}</p>}
            </TableCell>
            <TableCell className={td}>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[13px] tabular-nums text-[#D5DBE2]">{formatPhoneBR(l.phone_e164) || "—"}</span>
                <WhatsAppButton phone={l.phone_e164} />
              </div>
            </TableCell>
            <TableCell className={td}><OriginCell lead={l} /></TableCell>
            <TableCell className={td}><StageTrack lead={l} /></TableCell>
            <TableCell className={td}><Temperature value={l.temperature} /></TableCell>
            <TableCell className={`${td} whitespace-nowrap text-[13px] tabular-nums text-[#D5DBE2]`}>{formatDateTimeBR(l.created_at)}</TableCell>
            <TableCell className={`${td} whitespace-nowrap text-[13px] text-[#B8BEC5]`} title={formatDateTimeBR(l.last_event_at)}>
              {relativeTimeBR(l.last_event_at) || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Tap-to-chat for the phone cards: the number itself is the button.
function WhatsAppPill({ phone }) {
  const href = waLink(phone);
  if (!href) return <span className="text-[13px] text-[#6F7782]">Sem WhatsApp</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir conversa no WhatsApp com ${formatPhoneBR(phone)}`}
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-[#25D366]/35 bg-[#25D366]/[0.12] pl-3 pr-3.5 text-[14px] font-medium tabular-nums text-[#5BE08F] transition-colors active:bg-[#25D366]/25 ${focusRing}`}
    >
      <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      {formatPhoneBR(phone)}
    </a>
  );
}

function LeadCards({ rows, onOpen }) {
  return (
    <ul className="divide-y divide-white/[0.06]">
      {rows.map((l) => (
        <li key={l.id} onClick={(e) => onOpen(e, l.id)} className="cursor-pointer px-4 pb-3.5 pt-4 active:bg-[#12294A]/45">
          <div className="flex items-start justify-between gap-3">
            <Link
              to={`/painel/leads/${l.id}`}
              className={`min-w-0 flex-1 truncate rounded pt-0.5 text-[16px] font-semibold leading-snug text-white ${focusRing}`}
            >
              {l.name || "Sem nome"}
            </Link>
            <Temperature value={l.temperature} pill />
          </div>
          <div className="mt-2"><OriginCell lead={l} inline /></div>
          <div className="mt-3"><StageTrack lead={l} wrap /></div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] text-[#8E8E8E]" title={formatDateTimeBR(l.created_at)}>
              <Arrived iso={l.created_at} />
            </p>
            <WhatsAppPill phone={l.phone_e164} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-px p-1">
      <span className="sr-only">Carregando leads…</span>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="h-4 w-40 bg-white/[0.06]" />
          <Skeleton className="hidden h-4 w-28 bg-white/[0.05] md:block" />
          <Skeleton className="hidden h-4 w-32 bg-white/[0.05] md:block" />
          <Skeleton className="ml-auto h-4 w-24 bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function LeadsPage() {
  const { env } = useEnv();
  const [f, setF] = useState(INITIAL);
  const [draft, setDraft] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetClose = useRef(null);
  const sheetTrigger = useRef(null);
  const listTop = useRef(null);
  const onOpen = useOpenLead();
  useScrollLock(sheetOpen);

  // Filters sheet (phones): focus moves in on open, Escape closes, focus returns to "Filtros".
  useEffect(() => {
    if (!sheetOpen) return undefined;
    if (sheetClose.current) sheetClose.current.focus();
    const onKey = (e) => { if (e.key === "Escape") setSheetOpen(false); };
    document.addEventListener("keydown", onKey);
    const trigger = sheetTrigger.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      if (trigger) trigger.focus();
    };
  }, [sheetOpen]);

  // A new environment starts on page 1; reset during render so no request uses the old offset.
  const [pageEnv, setPageEnv] = useState(env);
  if (pageEnv !== env) {
    setPageEnv(env);
    if (f.page !== 0) setF((p) => ({ ...p, page: 0 }));
  }

  const range = periodRange(f);
  const setFilter = (key, value) => setF((p) => (p[key] === value ? p : { ...p, [key]: value, page: 0 }));

  // Search applies as the owner types (debounced) or right away on Enter.
  useEffect(() => {
    const t = setTimeout(() => setF((p) => (p.search === draft.trim() ? p : { ...p, search: draft.trim(), page: 0 })), 350);
    return () => clearTimeout(t);
  }, [draft]);

  const filterArgs = { env, fromIso: range.fromIso, toIso: range.toIso, origin: f.origin, stage: f.stage, search: f.search };

  const list = useQuery({
    queryKey: ["panel_leads", filterArgs, f.page],
    queryFn: async () => {
      const from = f.page * PAGE_SIZE;
      const { data, count, error } = await applyLeadFilters(supabase.from("panel_leads").select(LIST_COLUMNS, { count: "exact" }), filterArgs)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
    placeholderData: keepPreviousData,
  });

  const kpis = useQuery({
    queryKey: ["panel_leads_kpis", env, range.fromIso, range.toIso],
    queryFn: () => fetchKpis({ env, range }),
  });

  const rows = (list.data && list.data.rows) || [];
  const total = (list.data && list.data.count) || 0;
  const first = total ? f.page * PAGE_SIZE + 1 : 0;
  const last = Math.min((f.page + 1) * PAGE_SIZE, total);
  const filtered = Boolean(f.origin || f.stage || f.search);

  const choosePeriod = (period) => setF((p) => {
    if (p.period === period) return p;
    if (period !== "custom") return { ...p, period, page: 0 };
    return { ...p, period, from: p.from || range.fromDay, to: p.to || range.toDay, page: 0 };
  });

  const clearFilters = () => { setDraft(""); setF((p) => ({ ...p, origin: "", stage: "", search: "", page: 0 })); };
  // Filters behind the phone sheet (search stays outside it, always visible).
  const sheetCount = (f.period !== INITIAL.period ? 1 : 0) + (f.origin ? 1 : 0) + (f.stage ? 1 : 0);
  const resetSheet = () => setF((p) => ({ ...p, period: INITIAL.period, origin: "", stage: "", page: 0 }));
  const goToPage = (page) => {
    setF((p) => ({ ...p, page }));
    if (listTop.current && listTop.current.scrollIntoView) listTop.current.scrollIntoView({ block: "start" });
  };

  async function exportCsv() {
    setExporting(true);
    setExportError(false);
    try {
      const all = [];
      for (let from = 0; ; from += CHUNK) {
        // eslint-disable-next-line no-await-in-loop
        const { data, error } = await applyLeadFilters(supabase.from("panel_leads").select(CSV_SELECT), filterArgs)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < CHUNK) break;
      }
      downloadCSV(`leads-${env}-${range.fromDay}_a_${range.toDay}.csv`, toCSV(all, CSV_COLUMNS));
    } catch (e) {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  const envLabel = (ENV_OPTIONS.find((o) => o.value === env) || ENV_OPTIONS[0]).label.toLowerCase();

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="flex items-center justify-between gap-3 md:flex-wrap md:items-end md:gap-4">
        <div className="min-w-0">
          {/* Below lg the top bar already names the page. */}
          <h1 className="sr-only font-display text-[30px] font-semibold leading-tight tracking-tight text-white lg:not-sr-only lg:text-[34px]">Leads</h1>
          <p className="text-[14px] text-[#B8BEC5] lg:mt-1">{periodText(f, range)}, dados de {envLabel}.</p>
        </div>
        <button
          ref={sheetTrigger}
          type="button"
          aria-expanded={sheetOpen}
          aria-controls="filtros-leads"
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
        <div className="hidden flex-col items-end gap-1 md:flex">
          <Button
            type="button"
            variant="outline"
            onClick={exportCsv}
            disabled={exporting || !total}
            className={`h-9 rounded-lg border-white/15 bg-transparent px-3.5 text-[13px] text-[#E8EEF5] hover:border-[#7DB4E8] hover:bg-transparent hover:text-[#7DB4E8] ${focusRing}`}
          >
            <Download aria-hidden="true" />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
          {exportError && <p role="alert" className="text-[12px] text-[#F4B4B4]">Não foi possível exportar. Tente de novo.</p>}
        </div>
      </header>

      <div className="mt-4 md:mt-6">
        <KpiStrip query={kpis} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5 md:mt-6">
        {sheetOpen && (
          <button
            type="button"
            aria-label="Fechar filtros"
            tabIndex={-1}
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-40 bg-[#061224]/70 backdrop-blur-sm duration-200 animate-in fade-in motion-reduce:animate-none md:hidden"
          />
        )}
        {/* One set of filter controls: a bottom sheet on phones, inline in this row from md up (md:contents). */}
        <div
          id="filtros-leads"
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
            <label className="flex flex-col gap-2 md:contents">
              <span className="text-[13px] text-[#8E8E8E] md:hidden">Estágio</span>
              <select aria-label="Estágio" value={f.stage} onChange={(e) => setFilter("stage", e.target.value)} className={control}>
                <option value="">Todos os estágios</option>
                {STAGES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-5 md:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={exportCsv}
                disabled={exporting || !total}
                className={`h-11 w-full rounded-lg border-white/15 bg-transparent text-[15px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white ${focusRing}`}
              >
                <Download aria-hidden="true" />
                {exporting ? "Exportando…" : "Exportar CSV"}
              </Button>
              <p className="text-[13px] text-[#8E8E8E]">Leva os leads destes filtros e da busca.</p>
              {exportError && <p role="alert" className="text-[13px] text-[#F4B4B4]">Não foi possível exportar. Tente de novo.</p>}
            </div>
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
              {list.isFetching ? "Ver resultados" : total === 1 ? "Ver 1 lead" : `Ver ${numberFmt.format(total)} leads`}
            </Button>
          </div>
        </div>

        <form
          role="search"
          className="relative w-full md:w-auto md:min-w-[220px] md:flex-1 md:basis-[260px]"
          onSubmit={(e) => { e.preventDefault(); setFilter("search", draft.trim()); }}
        >
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E8E]" />
          <Input
            type="search"
            aria-label="Buscar por nome, telefone ou e-mail"
            placeholder="Buscar nome, telefone ou e-mail"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={`h-11 rounded-lg border-white/10 bg-[#061224] pl-9 text-[16px] text-[#E8EEF5] placeholder:text-[#8E8E8E] md:h-9 md:text-[13px] ${focusRing}`}
          />
        </form>
      </div>

      <section ref={listTop} aria-label="Lista de leads" className="mt-4 scroll-mt-20 overflow-hidden rounded-xl border border-white/[0.06] bg-[#061224]/50">
        {list.isError && !list.data ? (
          <div role="alert" className="flex flex-col items-start gap-3 px-5 py-10">
            <p className="text-[15px] font-medium text-white">Não foi possível carregar os leads.</p>
            <p className="text-[14px] text-[#B8BEC5]">Verifique a conexão e tente de novo.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => list.refetch()}
              className={`h-9 rounded-lg border-white/15 bg-transparent text-[13px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white ${focusRing}`}
            >
              <RotateCw aria-hidden="true" />
              Tentar de novo
            </Button>
          </div>
        ) : list.isPending ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-display text-[22px] text-white">{filtered ? "Nenhum lead com esses filtros." : "Nenhum lead neste período."}</p>
            <p className="mx-auto mt-2 max-w-sm text-[14px] text-[#B8BEC5]">
              {filtered ? "Limpe os filtros ou escolha outro período." : "Escolha um período maior para ver leads anteriores."}
            </p>
            {filtered && (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className={`mt-5 h-9 rounded-lg border-white/15 bg-transparent text-[13px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white ${focusRing}`}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div aria-busy={list.isFetching} className={list.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {list.isError && (
              <p role="alert" className="border-b border-white/[0.06] px-5 py-2.5 text-[13px] text-[#F4B4B4]">
                Não foi possível atualizar a lista.{" "}
                <button type="button" onClick={() => list.refetch()} className={`rounded text-[#7DB4E8] hover:underline ${focusRing}`}>Tentar de novo</button>
              </p>
            )}
            <div className="hidden md:block"><LeadsTable rows={rows} onOpen={onOpen} /></div>
            <div className="md:hidden"><LeadCards rows={rows} onOpen={onOpen} /></div>
          </div>
        )}

        {total > 0 && (
          <nav aria-label="Paginação" className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3.5 md:flex-row md:items-center md:justify-between md:py-3 lg:px-5">
            <p className="text-center text-[13px] tabular-nums text-[#8E8E8E] md:text-left">{`${numberFmt.format(first)}–${numberFmt.format(last)} de ${numberFmt.format(total)}`}</p>
            <div className="grid grid-cols-2 gap-2.5 md:flex md:gap-2">
              {[
                ["Anterior", f.page - 1, f.page === 0, ChevronLeft],
                ["Próxima", f.page + 1, last >= total, ChevronRight],
              ].map(([label, page, disabled, Icon]) => (
                <Button
                  key={label}
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => goToPage(page)}
                  className={`h-11 rounded-lg border-white/15 bg-transparent px-3 text-[15px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white md:h-8 md:text-[13px] ${label === "Próxima" ? "flex-row-reverse" : ""} ${focusRing}`}
                >
                  <Icon aria-hidden="true" className="md:hidden" />
                  {label}
                </Button>
              ))}
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
