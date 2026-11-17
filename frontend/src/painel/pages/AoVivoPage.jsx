import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Smartphone, Tablet, Eye, RotateCw, UserCheck } from "lucide-react";
import { supabase } from "../supabase";
import { useEnv } from "../EnvContext";
import { relativeTimeBR } from "../lib/format";
import { deviceLabel } from "../lib/timeline";
import { liveOrigin, liveSection } from "../lib/live";
import OriginBadge from "../OriginBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const LIVE_POLL_MS = 10000;
// landing_url is only read to tell the ad origin (click ids); it is never shown.
const LIVE_COLUMNS = "id,started_at,last_event_at,landing_url,utm_source,utm_campaign,keyword,device,lead_id,current_section";
const DEVICE_ICONS = { mobile: Smartphone, desktop: Monitor, tablet: Tablet };
const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";
const clockFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

async function fetchLive(env) {
  const { data, error } = await supabase.from("panel_sessions_live").select(LIVE_COLUMNS)
    .eq("env", env).order("last_event_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

function Pulse({ on }) {
  return (
    <span aria-hidden="true" className="relative flex h-3 w-3 shrink-0">
      {on && <span className="absolute inset-0 rounded-full bg-[#4FD883] opacity-60 motion-safe:animate-ping" />}
      <span className={`relative h-3 w-3 rounded-full ${on ? "bg-[#4FD883]" : "bg-white/25"}`} />
    </span>
  );
}

function SessionCard({ s, now }) {
  const origin = liveOrigin(s);
  const DeviceIcon = DEVICE_ICONS[s.device] || Smartphone;
  const device = capitalize(deviceLabel(s.device));
  const section = liveSection(s.current_section);
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-white/[0.06] bg-[#061224]/50 px-4 pb-3.5 pt-4">
      <div className="flex items-center justify-between gap-2">
        <OriginBadge
          origin={origin === "unpaid" ? "direct" : origin}
          label={origin === "unpaid" ? "Orgânico ou direto" : undefined}
        />
        {s.lead_id && (
          <Link
            to={`/painel/leads/${s.lead_id}`}
            className={`relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-[#4FD883]/35 bg-[#4FD883]/[0.12] px-2.5 text-[12px] font-semibold text-[#5BE08F] before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] hover:bg-[#4FD883]/20 ${focusRing}`}
          >
            <UserCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Já é lead
          </Link>
        )}
      </div>
      <p className={`mt-2.5 truncate text-[15px] leading-snug ${s.utm_campaign ? "font-medium text-white" : "text-[#8E8E8E]"}`} title={s.utm_campaign || undefined}>
        {s.utm_campaign || "Sem campanha"}
      </p>
      {s.keyword && <p className="mt-0.5 truncate text-[13px] text-[#8E8E8E]" title={s.keyword}>{`Palavra-chave: ${s.keyword}`}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#D5DBE2]">
        {device && (
          <span className="inline-flex items-center gap-1.5">
            <DeviceIcon className="h-4 w-4 text-[#8E8E8E]" strokeWidth={1.75} aria-hidden="true" />
            {device}
          </span>
        )}
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Eye className="h-4 w-4 shrink-0 text-[#8E8E8E]" strokeWidth={1.75} aria-hidden="true" />
          {section ? <span className="truncate"><span className="text-[#8E8E8E]">Última seção vista: </span>{section}</span> : <span className="text-[#8E8E8E]">Ainda no começo da página</span>}
        </span>
      </div>
      <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[12px] tabular-nums text-[#8E8E8E]">
        {`Chegou ${relativeTimeBR(s.started_at, now)}, ativo ${relativeTimeBR(s.last_event_at, now)}`}
      </p>
    </li>
  );
}

export default function AoVivoPage() {
  const { env } = useEnv();
  const live = useQuery({
    queryKey: ["panel_sessions_live", env],
    queryFn: () => fetchLive(env),
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const sessions = live.data || [];
  const now = live.dataUpdatedAt ? new Date(live.dataUpdatedAt) : new Date();
  const updated = live.dataUpdatedAt ? clockFmt.format(now) : "";
  const count = sessions.length;
  const title = live.isPending
    ? "Conferindo quem está no site…"
    : live.isError && !live.data
      ? "Ao vivo"
      : count === 0 ? "Ninguém no site agora" : `${count} ${count === 1 ? "pessoa" : "pessoas"} no site agora`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <header>
        <div className="flex items-center gap-3">
          <Pulse on={count > 0} />
          <h1 aria-live="polite" className="font-display text-[26px] lining-nums font-semibold leading-tight tracking-tight text-white lg:text-[34px]">{title}</h1>
        </div>
        <p className="mt-1.5 max-w-prose text-[14px] text-[#B8BEC5]">
          {updated
            ? `Quem mexeu na página nos últimos 5 minutos. Atualizado às ${updated}; confere de novo a cada 10 segundos.`
            : "Quem mexeu na página nos últimos 5 minutos."}
        </p>
      </header>

      {live.isError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#F4B4B4]/20 bg-[#F4B4B4]/[0.06] px-4 py-3 text-[14px] text-[#F4B4B4]">
          {live.data ? "Não foi possível ver quem está no site agora; mostrando a última lista." : "Não foi possível ver quem está no site."}
          <Button
            type="button"
            variant="outline"
            onClick={() => live.refetch()}
            className={`h-11 rounded-lg border-white/15 bg-transparent text-[15px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white md:h-9 md:text-[13px] ${focusRing}`}
          >
            <RotateCw aria-hidden="true" />
            Tentar de novo
          </Button>
        </div>
      )}

      {live.isPending ? (
        <div aria-busy="true" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[150px] rounded-xl bg-white/[0.04]" />)}
        </div>
      ) : count === 0 ? (
        !live.isError && (
          <div className="mt-5 rounded-xl border border-dashed border-white/10 px-5 py-14 text-center">
            <p className="font-display text-[20px] text-white">Ninguém navegando nos últimos 5 minutos.</p>
            <p className="mx-auto mt-2 max-w-sm text-[14px] text-[#B8BEC5]">
              Assim que alguém abrir a página, aparece aqui sem precisar recarregar.
            </p>
          </div>
        )
      ) : (
        <ul aria-label="Pessoas no site" className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => <SessionCard key={s.id} s={s} now={now} />)}
        </ul>
      )}
    </div>
  );
}
