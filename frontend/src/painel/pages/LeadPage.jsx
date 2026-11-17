import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowDownToLine, Check, CircleCheck, CircleHelp, ClipboardList, Cookie, Copy, DoorOpen, Eye, Film, Image,
  LogIn, Mail, MessageCircle, Monitor, MousePointerClick, PartyPopper, Pause, PenLine, Play, RotateCw, Send, Smartphone,
  Tablet, TriangleAlert, Volume2, Circle,
} from "lucide-react";
import { supabase } from "../supabase";
import { labelFor, eventKind, isMilestone } from "../lib/eventLabels";
import {
  groupVisits, summarize, leadMilestones, formatDuration, formatSeconds, deviceLabel, pathOf, hostOf,
} from "../lib/timeline";
import { originLabel, originTone } from "../lib/origin";
import { formatPhoneBR, waLink, formatDateTimeBR, formatShortDateTimeBR, formatTimeBR } from "../lib/format";
import { Temperature } from "./LeadsPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const EVENTS_LIMIT = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEAD_COLUMNS =
  "id,env,name,phone_e164,email,created_at,submitted_at,rd_confirmed_at,thank_you_at,whatsapp_at,stage,origin,utm_source,utm_medium,utm_campaign,utm_term,keyword,gclid,fbclid,device,landing_url,referrer,visits,video_max_pct,faq_questions,temperature";
const EVENT_COLUMNS = "occurred_at,session_id,session_started_at,device,type,name,section,props";

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";
const ghostButton = `h-9 rounded-lg border-white/15 bg-transparent text-[13px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white ${focusRing}`;
const numberFmt = new Intl.NumberFormat("pt-BR");

const ICONS = {
  page_view: LogIn,
  video_play: Play,
  video_pause: Pause,
  video_sound: Volume2,
  video_progress: Film,
  video_other: Film,
  faq_open: CircleHelp,
  section_view: Eye,
  scroll_depth: ArrowDownToLine,
  slider_view: Image,
  cta_click: MousePointerClick,
  form_view: ClipboardList,
  form_start: PenLine,
  form_field_complete: Check,
  form_abandon: DoorOpen,
  form_submit_attempt: Send,
  lead_submitted: CircleCheck,
  thank_you_view: PartyPopper,
  whatsapp_click: MessageCircle,
  rage_click: TriangleAlert,
  consent: Cookie,
  other: Circle,
};
const MILESTONE_TONE = { lead_submitted: "#7DB4E8", thank_you_view: "#7DB4E8", whatsapp_click: "#4FD883" };
const MILESTONE_DOT = { tentou: "#7DB4E8", chegou_obrigado: "#7DB4E8", foi_whatsapp: "#4FD883" };
const DEVICE_ICONS = { mobile: Smartphone, desktop: Monitor, tablet: Tablet };

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Gap between two visits, in words: "2 h depois", "3 dias depois".
function gapText(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(min, 1)} min depois`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h depois`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 dia depois" : `${d} dias depois`;
}

/* ---------- pieces ---------- */

function BackLink() {
  return (
    <Link to="/painel" className={`hidden items-center gap-1.5 rounded text-[13px] font-medium text-[#7DB4E8] hover:text-white lg:inline-flex ${focusRing}`}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Leads
    </Link>
  );
}

function Milestones({ lead }) {
  const items = leadMilestones(lead);
  return (
    <ol aria-label="Marcos do lead" className="flex flex-col sm:grid sm:grid-cols-3">
      {items.map((m, i) => {
        const next = items[i + 1];
        const link = next && next.done ? "bg-[#5B95CE]/70" : "border-dashed border-white/15";
        return (
          <li key={m.key} data-done={String(m.done)} className="relative flex items-center gap-3 py-2 sm:block sm:py-0 sm:pr-2">
            <div className="flex items-center">
              <span
                aria-hidden="true"
                className={`relative z-10 block h-3 w-3 shrink-0 rounded-full ${m.done ? "" : "border border-dashed border-white/30 bg-[#0A1930]"}`}
                style={m.done ? { background: MILESTONE_DOT[m.key], boxShadow: `0 0 0 4px ${MILESTONE_DOT[m.key]}26` } : undefined}
              />
              {next && <span aria-hidden="true" className={`ml-1 hidden h-px flex-1 sm:block ${next.done ? link : `border-t ${link}`}`} />}
            </div>
            {next && (
              <span
                aria-hidden="true"
                className={`absolute left-[5.5px] top-[calc(50%+10px)] h-[calc(100%-20px)] sm:hidden ${next.done ? `w-px ${link}` : `border-l ${link}`}`}
              />
            )}
            <p className={`min-w-0 flex-1 text-[15px] font-medium leading-snug sm:mt-2.5 sm:text-[13px] ${m.done ? "text-white" : "text-[#8E8E8E]"}`}>{m.label}</p>
            <p className={`shrink-0 text-[13px] tabular-nums sm:mt-0.5 sm:text-[12px] ${m.done ? "text-[#B8BEC5]" : "text-[#6F7782]"}`}>
              {m.done ? formatShortDateTimeBR(m.at) : "Ainda não"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, children }) {
  return (
    <div className="bg-[#0A1930] px-3.5 py-3 sm:px-4 sm:py-3.5 lg:px-5">
      <dt className="text-[12px] text-[#8E8E8E]">{label}</dt>
      <dd className="mt-1 font-display text-[20px] font-semibold leading-tight text-white sm:text-[22px]">{children}</dd>
    </div>
  );
}

function Summary({ summary }) {
  const s = summary;
  return (
    <section aria-label="Resumo">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] lg:grid-cols-4">
        <Fact label="Tempo na página"><span className="tabular-nums">{formatSeconds(s.totalSeconds)}</span></Fact>
        <Fact label="Vídeo">
          {s.videoMaxPct === null ? <span className="text-[#8E8E8E]">Não assistiu</span> : <span className="tabular-nums">até {Math.round(s.videoMaxPct)}%</span>}
        </Fact>
        <Fact label="Visitas"><span className="tabular-nums">{s.visits === 1 ? "1 visita" : `${numberFmt.format(s.visits)} visitas`}</span></Fact>
        <Fact label="Veio de">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: originTone(s.origin) }} />
            {originLabel(s.origin)}
          </span>
        </Fact>
      </dl>
      <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#061224]/50 px-4 py-3.5 lg:px-5">
        <h2 className="font-sans text-[12px] text-[#8E8E8E]">
          {s.faqQuestions.length ? `Dúvidas que abriu (${s.faqQuestions.length})` : "Dúvidas que abriu"}
        </h2>
        {s.faqQuestions.length ? (
          <ul className="mt-1.5 space-y-1">
            {s.faqQuestions.map((q) => (
              <li key={q} className="flex gap-2 text-[14px] leading-snug text-[#E8EEF5]">
                <CircleHelp className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#7DB4E8]" aria-hidden="true" />
                {q}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[14px] text-[#B8BEC5]">Não abriu nenhuma dúvida.</p>
        )}
      </div>
    </section>
  );
}

function CopyValue({ value, label }) {
  const [state, setState] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("ok");
    } catch (e) {
      setState("fail");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };
  return (
    <div className="flex min-w-0 items-start gap-2">
      <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] leading-relaxed text-[#E8EEF5]">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copiar ${label}`}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-3 text-[13px] text-[#B8BEC5] transition-colors hover:border-[#7DB4E8]/50 hover:text-white sm:h-7 sm:px-2 sm:text-[12px] ${focusRing}`}
      >
        {state === "ok" ? <Check className="h-3.5 w-3.5 text-[#4FD883]" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        <span aria-live="polite">{state === "ok" ? "Copiado" : state === "fail" ? "Não copiou" : "Copiar"}</span>
      </button>
    </div>
  );
}

function OriginRow({ label, children, field }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[13px] text-[#8E8E8E]">{label}</dt>
      <dd data-field={field} className="min-w-0 break-words text-[15px] text-[#E8EEF5] sm:text-[13.5px]">{children}</dd>
    </div>
  );
}

function OriginCard({ lead }) {
  const none = <span className="text-[#6F7782]">—</span>;
  const keyword = lead.keyword || lead.utm_term;
  const landing = pathOf(lead.landing_url);
  const ref = hostOf(lead.referrer);
  return (
    <section aria-label="Origem" className="rounded-xl border border-white/[0.06] bg-[#061224]/60 px-4 py-4 lg:px-5">
      <h2 className="font-display text-[19px] font-semibold text-white">De onde veio</h2>
      <dl className="mt-2 divide-y divide-white/[0.06]">
        <OriginRow label="Origem">
          <Badge variant="outline" className="gap-1.5 rounded-md border-white/10 bg-white/[0.03] px-2 py-0.5 text-[12px] font-medium text-[#E8EEF5] shadow-none">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: originTone(lead.origin) }} />
            {originLabel(lead.origin)}
          </Badge>
        </OriginRow>
        <OriginRow label="Campanha">{lead.utm_campaign || none}</OriginRow>
        <OriginRow label="Palavra-chave">{keyword || none}</OriginRow>
        <OriginRow label="gclid">{lead.gclid ? <CopyValue value={lead.gclid} label="gclid" /> : none}</OriginRow>
        <OriginRow label="Dispositivo">{capitalize(deviceLabel(lead.device)) || none}</OriginRow>
        <OriginRow label="Página de entrada" field="landing">{landing || none}</OriginRow>
        <OriginRow label="Veio do site">{ref || (lead.referrer ? lead.referrer : <span className="text-[#8E8E8E]">Nenhum (acesso direto)</span>)}</OriginRow>
      </dl>
    </section>
  );
}

function TimelineItem({ event }) {
  const kind = eventKind(event);
  const Icon = ICONS[kind] || Circle;
  const milestone = isMilestone(event);
  const tone = MILESTONE_TONE[event.type];
  const warn = kind === "rage_click" || kind === "form_abandon";
  return (
    <li
      data-milestone={String(milestone)}
      className={`relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-3 sm:grid-cols-[3.25rem_1.75rem_minmax(0,1fr)] ${milestone ? "py-2.5" : "py-1.5"}`}
    >
      <time dateTime={event.occurred_at} className="order-3 pt-[5px] text-right text-[12.5px] tabular-nums text-[#8E8E8E] sm:order-none">
        {formatTimeBR(event.occurred_at)}
      </time>
      <span
        aria-hidden="true"
        className={`relative z-10 order-1 flex h-7 w-7 items-center justify-center rounded-full border sm:order-none ${
          milestone ? "border-transparent" : warn ? "border-[#D9BB78]/30 bg-[#0A1930] text-[#D9BB78]" : "border-white/10 bg-[#0A1930] text-[#8E9BAB]"
        }`}
        style={milestone ? { background: tone, color: "#061224", boxShadow: `0 0 0 5px ${tone}22` } : undefined}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={milestone ? 2.25 : 1.75} />
      </span>
      <p className={`order-2 sm:order-none ${milestone ? "pt-[3px] text-[15.5px] font-semibold leading-snug text-white" : "pt-[4px] text-[15px] leading-snug text-[#D5DBE2] sm:text-[14px]"}`}>
        {labelFor(event)}
      </p>
    </li>
  );
}

function Visit({ visit, previous }) {
  const DeviceIcon = DEVICE_ICONS[visit.device] || Smartphone;
  const gap = previous ? Date.parse(visit.startedAt) - Date.parse(previous.lastAt) : 0;
  const device = deviceLabel(visit.device);
  return (
    <section data-visit={visit.number} aria-labelledby={`visita-${visit.number}`}>
      {previous && gap > 30 * 60000 && (
        <p className="mb-3 pl-[2.5rem] text-[13px] italic text-[#8E8E8E] sm:pl-[4rem] sm:text-[12.5px]">Voltou {gapText(gap)}</p>
      )}
      <h3
        id={`visita-${visit.number}`}
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/[0.06] bg-[#0A1930]/95 px-4 py-2.5 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      >
        <span className="font-display text-[21px] font-semibold text-white">Visita {visit.number}</span>
        <span className="inline-flex items-center gap-1.5 font-sans text-[13px] tabular-nums text-[#B8BEC5]">
          <DeviceIcon className="h-3.5 w-3.5 self-center text-[#7DB4E8]" aria-hidden="true" />
          {[formatShortDateTimeBR(visit.startedAt), device, formatDuration(visit.durationMs)].filter(Boolean).join(" · ")}
        </span>
      </h3>
      <ol className="relative mt-3 before:absolute before:bottom-4 before:left-[calc(0.875rem-0.5px)] before:top-4 before:w-px before:bg-white/[0.12] sm:before:left-[calc(3.25rem+0.75rem+0.875rem-0.5px)]">
        {visit.items.map((e, i) => <TimelineItem key={`${e.occurred_at}-${i}`} event={e} />)}
      </ol>
    </section>
  );
}

function Timeline({ query, visits, count }) {
  if (query.isPending) {
    return (
      <div aria-busy="true" className="space-y-3">
        <span className="sr-only">Carregando a linha do tempo…</span>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-10 bg-white/[0.05]" />
            <Skeleton className="h-7 w-7 rounded-full bg-white/[0.06]" />
            <Skeleton className="h-3.5 w-56 bg-white/[0.05]" />
          </div>
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="rounded-xl border border-white/[0.06] px-5 py-6">
        <p className="text-[15px] font-medium text-white">Não foi possível carregar a linha do tempo.</p>
        <Button type="button" variant="outline" onClick={() => query.refetch()} className={`mt-3 ${ghostButton}`}>
          <RotateCw aria-hidden="true" />
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!visits.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-5 py-8">
        <p className="font-display text-[19px] text-white">Nenhum passo registrado para este lead.</p>
        <p className="mt-1.5 max-w-prose text-[14px] text-[#B8BEC5]">
          O formulário chegou, mas a navegação não foi registrada. Isso acontece, por exemplo, quando o visitante usa um bloqueador de rastreamento.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-7 lg:space-y-9">
      {count >= EVENTS_LIMIT && (
        <p className="text-[13px] text-[#D9BB78]">Mostrando os primeiros {numberFmt.format(EVENTS_LIMIT)} passos deste lead.</p>
      )}
      {visits.map((v, i) => <Visit key={v.sessionId} visit={v} previous={visits[i - 1]} />)}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1200px]">
      <span className="sr-only">Carregando o lead…</span>
      <Skeleton className="h-4 w-16 bg-white/[0.05]" />
      <Skeleton className="mt-5 h-10 w-72 max-w-full bg-white/[0.07]" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full bg-white/[0.05]" />
      <Skeleton className="mt-8 h-20 w-full bg-white/[0.04]" />
      <Skeleton className="mt-6 h-64 w-full bg-white/[0.04]" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <BackLink />
      <div className="mt-10 max-w-md">
        <h1 className="font-display text-[28px] font-semibold text-white">Lead não encontrado</h1>
        <p className="mt-2 text-[15px] text-[#B8BEC5]">
          O link pode estar incompleto ou o lead não existe mais. Volte para a lista e abra o lead por lá.
        </p>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function LeadPage() {
  const { id } = useParams();
  const valid = UUID.test(String(id || ""));

  const lead = useQuery({
    queryKey: ["panel_lead", id],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await supabase.from("panel_leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["panel_lead_events", id],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await supabase.from("panel_lead_events").select(EVENT_COLUMNS)
        .eq("lead_id", id)
        .order("occurred_at", { ascending: true })
        .limit(EVENTS_LIMIT);
      if (error) throw error;
      return data || [];
    },
  });

  if (!valid) return <NotFound />;
  if (lead.isError && !lead.data) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <BackLink />
        <div role="alert" className="mt-8 flex flex-col items-start gap-3">
          <p className="text-[15px] font-medium text-white">Não foi possível carregar este lead.</p>
          <p className="text-[14px] text-[#B8BEC5]">Verifique a conexão e tente de novo.</p>
          <Button type="button" variant="outline" onClick={() => { lead.refetch(); events.refetch(); }} className={ghostButton}>
            <RotateCw aria-hidden="true" />
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }
  if (lead.isPending) return <PageSkeleton />;
  if (!lead.data) return <NotFound />;

  const l = lead.data;
  const evs = events.data || [];
  const visits = groupVisits(evs);
  const summary = summarize(evs, l);
  const wa = waLink(l.phone_e164);

  return (
    <div className="mx-auto max-w-[1200px]">
      <BackLink />

      <header className="rounded-2xl border border-white/[0.07] bg-[#061224]/60 p-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 lg:mt-4">
        <div className="flex flex-col items-start gap-2.5 md:flex-row md:flex-wrap md:justify-between md:gap-x-6 md:gap-y-3">
          <h1 className="min-w-0 break-words font-display text-[27px] font-semibold leading-[1.12] tracking-tight text-white md:text-[32px] md:leading-[1.1] lg:text-[40px]">
            {l.name || "Sem nome"}
          </h1>
          <div className="md:pt-2"><Temperature value={l.temperature} pill /></div>
        </div>
        <div className="mt-4 flex flex-col gap-3 text-[15px] md:mt-3 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-2.5 md:text-[14px]">
          {l.phone_e164 && (
            <span className="flex flex-col gap-3 md:inline-flex md:flex-row md:items-center md:gap-2.5">
              <span className="tabular-nums text-[#E8EEF5]">{formatPhoneBR(l.phone_e164)}</span>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-[16px] font-semibold text-[#06210F] transition-colors active:bg-[#1FB959] md:h-9 md:justify-start md:gap-1.5 md:rounded-lg md:border md:border-[#25D366]/35 md:bg-[#25D366]/10 md:px-3 md:text-[13px] md:font-medium md:text-[#4FD883] md:hover:bg-[#25D366]/20 ${focusRing}`}
                >
                  <MessageCircle className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" />
                  Abrir WhatsApp
                </a>
              )}
            </span>
          )}
          {l.email && (
            <a href={`mailto:${l.email}`} className={`inline-flex min-h-11 min-w-0 items-center gap-2 break-all rounded text-[#B8BEC5] hover:text-[#7DB4E8] md:min-h-0 md:gap-1.5 ${focusRing}`}>
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              {l.email}
            </a>
          )}
        </div>
        <p className="mt-1 text-[13px] text-[#8E8E8E] md:mt-2">Chegou em {formatDateTimeBR(l.created_at)}</p>

        <div className="mt-4 max-w-2xl border-t border-white/[0.06] pt-2 sm:pt-4 md:mt-7 md:border-0 md:pt-0">
          <Milestones lead={l} />
        </div>
      </header>

      <div className="mt-5 md:mt-8">
        <Summary summary={summary} />
      </div>

      <div className="mt-8 grid gap-8 md:mt-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <aside className="lg:order-2">
          <div className="lg:sticky lg:top-20"><OriginCard lead={l} /></div>
        </aside>
        <section aria-labelledby="linha-do-tempo" className="min-w-0 lg:order-1">
          <h2 id="linha-do-tempo" className="mb-3 font-display text-[24px] font-semibold text-white lg:mb-5">Linha do tempo</h2>
          <Timeline query={events} visits={visits} count={evs.length} />
        </section>
      </div>
    </div>
  );
}
