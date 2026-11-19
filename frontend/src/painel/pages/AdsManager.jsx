import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { relativeTimeBR, formatDateTimeBR } from "../lib/format";
import { matchTypeLabel } from "../lib/ads";
import { Panel, LoadError } from "./parts";

// See and edit Google Ads campaigns. Edits go to ads_commands; the Google Ads script picks them up
// (about a minute while it is watching the queue, at most about an hour) and reports the result.

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";
const btn = `inline-flex h-10 items-center rounded-lg border border-white/15 px-3 text-[14px] text-[#E8EEF5] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:text-[13px] ${focusRing}`;
const btnPrimary = `inline-flex h-10 items-center rounded-lg bg-[#7DB4E8] px-3 text-[14px] font-semibold text-[#061224] transition-colors hover:bg-[#9CC7EF] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#8E8E8E] md:h-8 md:text-[13px] ${focusRing}`;
const input = `h-10 rounded-lg border border-white/10 bg-[#061224] px-3 text-[16px] text-[#E8EEF5] md:h-8 md:text-[13px] ${focusRing}`;

const OPEN = ["pending", "sent"];
const CHANNELS = {
  SEARCH: "Pesquisa", PERFORMANCE_MAX: "Performance Max", VIDEO: "YouTube", DISPLAY: "Display",
  DEMAND_GEN: "Demand Gen", DISCOVERY: "Demand Gen", SHOPPING: "Shopping", MULTI_CHANNEL: "App",
};
const STATUS = { ENABLED: "Ativa", PAUSED: "Pausada" };
const COMMAND_STATUS = {
  pending: "Aguardando o Google Ads", sent: "Aplicando…", applied: "Aplicada",
  failed: "Falhou", expired: "Expirou", canceled: "Cancelada",
};
const MATCH_OPTIONS = [["PHRASE", "Frase"], ["EXACT", "Exata"], ["BROAD", "Ampla"]];

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const microsText = (m) => (m === null || m === undefined ? "—" : brl.format(Number(m) / 1e6));

// "150", "150,5", "1.200,00" -> micros in whole cents, or null when not a valid R$ 1 - R$ 10.000.
export function parseBudget(text) {
  const t = String(text || "").trim().replace(/\s|R\$/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([,.]\d{1,2})?$/.test(t)) return null;
  // pt-BR: "1.200" is twelve hundred; "150.5" (no comma, not groups of 3) is a decimal point.
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents < 100 || cents > 1000000) return null;
  return cents * 10000;
}

async function fetchTable(table, columns, build) {
  let q = supabase.from(table).select(columns);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export function commandText(c) {
  const p = c.previous || {};
  const v = c.value || {};
  const camp = p.campaign_name ? `"${p.campaign_name}"` : `campanha ${c.campaign_id}`;
  switch (c.kind) {
    case "campaign_status": return `${v.status === "PAUSED" ? "Pausar" : "Ativar"} ${camp}`;
    case "campaign_budget": return `Orçamento de ${camp}: ${microsText(p.amount_micros)} → ${microsText(v.amount_micros)} por dia`;
    case "keyword_status": return `${v.status === "PAUSED" ? "Pausar" : "Ativar"} a palavra-chave "${p.keyword_text || c.criterion_id}" em ${camp}`;
    case "campaign_negative": return `Negativa "${v.text}" (${matchTypeLabel(v.match_type) || v.match_type}) em ${camp}`;
    default: return c.kind;
  }
}

function StatusBadge({ status }) {
  const on = status === "ENABLED";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ${on ? "bg-[#4FD883]/10 text-[#8FE6AE]" : "bg-white/[0.06] text-[#B8BEC5]"}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[#4FD883]" : "bg-[#8E8E8E]"}`} />
      {STATUS[status] || status || "—"}
    </span>
  );
}

function Waiting({ children }) {
  return <span className="text-[13px] text-[#E9CF93]">{children}</span>;
}

function KeywordList({ campaign, keywords, openFor, send, busy }) {
  const [text, setText] = useState("");
  const [match, setMatch] = useState("PHRASE");
  const term = text.trim();
  const addNegative = (e) => {
    e.preventDefault();
    if (!term || term.length > 80) return;
    const label = MATCH_OPTIONS.find(([m]) => m === match)[1].toLowerCase();
    if (!window.confirm(`Adicionar "${term}" como palavra-chave negativa (${label}) em "${campaign.campaign_name}"? Os anúncios dessa campanha deixam de aparecer para essa busca.`)) return;
    send({ kind: "campaign_negative", campaign_id: campaign.campaign_id, value: { text: term, match_type: match }, previous: { campaign_name: campaign.campaign_name } })
      .then((ok) => { if (ok) setText(""); });
  };
  return (
    <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#061224]/60">
      {keywords.length === 0 ? (
        <p className="px-3 py-3 text-[13px] text-[#8E8E8E]">Esta campanha não tem palavras-chave (Performance Max e YouTube não usam).</p>
      ) : (
        <ul aria-label={`Palavras-chave de ${campaign.campaign_name}`} className="divide-y divide-white/[0.06]">
          {keywords.map((k) => {
            const pending = openFor("keyword_status", campaign.campaign_id, k.criterion_id, k.ad_group_id);
            const next = k.status === "ENABLED" ? "PAUSED" : "ENABLED";
            return (
              <li key={`${k.ad_group_id}~${k.criterion_id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] text-[#E8EEF5]">
                    {k.keyword_text}
                    {matchTypeLabel(k.match_type) && <span className="ml-2 text-[12px] text-[#8E8E8E]">{matchTypeLabel(k.match_type)}</span>}
                  </p>
                  <p className="text-[12px] text-[#8E8E8E]">{k.ad_group_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={k.status} />
                  {pending ? <Waiting>{COMMAND_STATUS[pending.status]}</Waiting> : (
                    <button
                      type="button"
                      className={btn}
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`${next === "PAUSED" ? "Pausar" : "Ativar"} a palavra-chave "${k.keyword_text}"?`)) return;
                        send({ kind: "keyword_status", campaign_id: campaign.campaign_id, ad_group_id: k.ad_group_id, criterion_id: k.criterion_id, value: { status: next }, previous: { status: k.status, keyword_text: k.keyword_text, campaign_name: campaign.campaign_name } });
                      }}
                    >
                      {next === "PAUSED" ? "Pausar" : "Ativar"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={addNegative} aria-label={`Palavra-chave negativa em ${campaign.campaign_name}`} className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 py-3">
        <input aria-label="Palavra-chave negativa" placeholder="Ex.: aluguel" maxLength={80} value={text} onChange={(e) => setText(e.target.value)} className={`${input} min-w-0 flex-1`} />
        <select aria-label="Correspondência" value={match} onChange={(e) => setMatch(e.target.value)} className={input}>
          {MATCH_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className={btnPrimary} disabled={busy || !term}>Adicionar negativa</button>
      </form>
    </div>
  );
}

function BudgetForm({ campaign, send, busy, onClose }) {
  const [text, setText] = useState(campaign.budget_micros ? String(Number(campaign.budget_micros) / 1e6).replace(".", ",") : "");
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const micros = parseBudget(text);
    if (micros === null) { setError("Digite um valor entre R$ 1 e R$ 10.000, por exemplo 150 ou 150,50."); return; }
    const old = Number(campaign.budget_micros) || 0;
    const big = old > 0 && Math.abs(micros - old) / old > 0.5;
    const shared = campaign.budget_shared ? " Esse orçamento é compartilhado: muda também nas outras campanhas que o usam." : "";
    const msg = `Mudar o orçamento diário de "${campaign.campaign_name}" de ${microsText(old || null)} para ${microsText(micros)}?${big ? " É uma mudança de mais de 50%." : ""}${shared}`;
    if (!window.confirm(msg)) return;
    send({ kind: "campaign_budget", campaign_id: campaign.campaign_id, value: { amount_micros: micros }, previous: { amount_micros: campaign.budget_micros, campaign_name: campaign.campaign_name } })
      .then((ok) => { if (ok) onClose(); });
  };
  return (
    <form onSubmit={submit} aria-label={`Orçamento de ${campaign.campaign_name}`} className="mt-3 flex flex-wrap items-center gap-2">
      <label className="text-[13px] text-[#B8BEC5]" htmlFor={`budget-${campaign.campaign_id}`}>R$ por dia</label>
      <input id={`budget-${campaign.campaign_id}`} inputMode="decimal" value={text} onChange={(e) => { setText(e.target.value); setError(""); }} className={`${input} w-32`} />
      <button type="submit" className={btnPrimary} disabled={busy}>Salvar</button>
      <button type="button" className={btn} onClick={onClose}>Cancelar</button>
      {error && <p role="alert" className="w-full text-[13px] text-[#F4B1AA]">{error}</p>}
    </form>
  );
}

function CampaignRow({ campaign, keywords, openFor, send, busy }) {
  const [panel, setPanel] = useState(null); // null | "budget" | "keywords"
  const statusPending = openFor("campaign_status", campaign.campaign_id);
  const budgetPending = openFor("campaign_budget", campaign.campaign_id);
  const next = campaign.status === "ENABLED" ? "PAUSED" : "ENABLED";
  const toggle = (p) => setPanel((cur) => (cur === p ? null : p));
  return (
    <li className="px-4 py-3.5 lg:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-white" title={campaign.campaign_name}>{campaign.campaign_name || `Campanha ${campaign.campaign_id}`}</p>
          <p className="mt-0.5 text-[13px] text-[#8E8E8E]">
            {[CHANNELS[campaign.channel] || campaign.channel, `${microsText(campaign.budget_micros)}/dia`, campaign.budget_shared ? "orçamento compartilhado" : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={campaign.status} />
          {statusPending ? <Waiting>{`${next === "PAUSED" ? "Pausando" : "Ativando"}: ${COMMAND_STATUS[statusPending.status].toLowerCase()}`}</Waiting> : (
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => {
                const what = next === "PAUSED" ? "Pausar" : "Ativar";
                const why = next === "PAUSED" ? " Os anúncios dela param de aparecer." : " Os anúncios dela voltam a aparecer e a gastar.";
                if (!window.confirm(`${what} a campanha "${campaign.campaign_name}"?${why}`)) return;
                send({ kind: "campaign_status", campaign_id: campaign.campaign_id, value: { status: next }, previous: { status: campaign.status, campaign_name: campaign.campaign_name } });
              }}
            >
              {next === "PAUSED" ? "Pausar" : "Ativar"}
            </button>
          )}
          {budgetPending ? <Waiting>{`Orçamento: ${COMMAND_STATUS[budgetPending.status].toLowerCase()}`}</Waiting> : (
            <button type="button" className={btn} aria-expanded={panel === "budget"} onClick={() => toggle("budget")}>Orçamento</button>
          )}
          <button type="button" className={btn} aria-expanded={panel === "keywords"} onClick={() => toggle("keywords")}>
            {`Palavras-chave (${keywords.length})`}
          </button>
        </div>
      </div>
      {panel === "budget" && !budgetPending && <BudgetForm campaign={campaign} send={send} busy={busy} onClose={() => setPanel(null)} />}
      {panel === "keywords" && <KeywordList campaign={campaign} keywords={keywords} openFor={openFor} send={send} busy={busy} />}
    </li>
  );
}

function Changes({ commands, cancel, busy }) {
  if (!commands.length) return null;
  return (
    <div className="border-t border-white/[0.06] px-4 py-3.5 lg:px-5">
      <h3 className="text-[14px] font-semibold text-white">Alterações</h3>
      <ul aria-label="Alterações enviadas" className="mt-2 space-y-2">
        {commands.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 text-[13px]">
            <div className="min-w-0">
              <p className="text-[#E8EEF5]">{commandText(c)}</p>
              <p className="text-[12px] text-[#8E8E8E]" title={formatDateTimeBR(c.created_at)}>
                {`Pedida ${relativeTimeBR(c.created_at)}`}
                {c.error && <span className="text-[#F4B1AA]">{` · ${c.error}`}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={c.status === "applied" ? "text-[#8FE6AE]" : c.status === "failed" ? "text-[#F4B1AA]" : OPEN.includes(c.status) ? "text-[#E9CF93]" : "text-[#8E8E8E]"}>
                {COMMAND_STATUS[c.status] || c.status}
              </span>
              {c.status === "pending" && (
                <button type="button" className={btn} disabled={busy} onClick={() => cancel(c)}>Cancelar</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdsManager() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const campaignsQ = useQuery({
    queryKey: ["ads_campaigns"],
    queryFn: () => fetchTable("ads_campaigns", "campaign_id,campaign_name,status,channel,budget_micros,budget_shared,synced_at"),
    refetchInterval: 60 * 1000,
  });
  const keywordsQ = useQuery({
    queryKey: ["ads_keywords"],
    queryFn: () => fetchTable("ads_keywords", "campaign_id,ad_group_id,ad_group_name,criterion_id,keyword_text,match_type,status"),
    refetchInterval: 60 * 1000,
  });
  const commandsQ = useQuery({
    queryKey: ["ads_commands"],
    queryFn: () => fetchTable("ads_commands", "id,kind,campaign_id,ad_group_id,criterion_id,value,previous,status,error,created_at,done_at",
      (q) => q.order("id", { ascending: false }).limit(20)),
    refetchInterval: (q) => ((q.state.data || []).some((c) => OPEN.includes(c.status)) ? 15 * 1000 : 60 * 1000),
  });

  const commands = commandsQ.data || [];
  const openFor = (kind, campaignId, criterionId, adGroupId) => commands.find((c) => OPEN.includes(c.status) && c.kind === kind
    && c.campaign_id === campaignId && (criterionId === undefined || (c.criterion_id === criterionId && c.ad_group_id === adGroupId)));

  const refresh = () => Promise.all(["ads_commands", "ads_campaigns", "ads_keywords"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const send = async (row) => {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("ads_commands").insert(row);
    setBusy(false);
    if (err) { setError("Não foi possível enviar a alteração. Tente de novo."); return false; }
    await refresh();
    return true;
  };
  const cancel = async (c) => {
    if (!window.confirm(`Cancelar: ${commandText(c)}?`)) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("ads_commands").update({ status: "canceled" }).eq("id", c.id).eq("status", "pending");
    setBusy(false);
    if (err) setError("Não foi possível cancelar. Talvez o Google Ads já esteja aplicando.");
    await refresh();
  };

  const campaigns = [...(campaignsQ.data || [])].sort((a, b) =>
    (a.status === "ENABLED" ? 0 : 1) - (b.status === "ENABLED" ? 0 : 1) || String(a.campaign_name || "").localeCompare(String(b.campaign_name || "")));
  const keywordsOf = (id) => (keywordsQ.data || []).filter((k) => k.campaign_id === id)
    .sort((a, b) => String(a.keyword_text || "").localeCompare(String(b.keyword_text || "")));
  const syncedAt = campaigns.reduce((m, c) => (c.synced_at && c.synced_at > m ? c.synced_at : m), "");

  return (
    <Panel
      label="Gerenciar campanhas"
      title="Gerenciar campanhas"
      className="mt-4 lg:mt-5"
      aside={<p className="text-[13px] text-[#8E8E8E]">{syncedAt ? `Situação lida do Google Ads ${relativeTimeBR(syncedAt)}` : "Alterações chegam ao Google Ads em minutos (no máximo 1 hora)"}</p>}
    >
      {error && <p role="alert" className="px-4 pt-2 text-[13px] text-[#F4B1AA] lg:px-5">{error}</p>}
      {campaignsQ.isError && !campaignsQ.data ? (
        <LoadError what="as campanhas" onRetry={() => campaignsQ.refetch()} />
      ) : campaignsQ.isPending ? (
        <p className="px-4 py-6 text-[14px] text-[#8E8E8E] lg:px-5">Carregando as campanhas…</p>
      ) : campaigns.length === 0 ? (
        <p className="px-4 py-6 text-[14px] leading-relaxed text-[#B8BEC5] lg:px-5">
          Para ver e editar as campanhas aqui, cole a versão 2 do script do Radar no Google Ads (Ferramentas → Ações em massa → Scripts) e execute uma vez.
        </p>
      ) : (
        <>
          <ul aria-label="Campanhas do Google Ads" className="mt-1 divide-y divide-white/[0.06]">
            {campaigns.map((c) => (
              <CampaignRow key={c.campaign_id} campaign={c} keywords={keywordsOf(c.campaign_id)} openFor={openFor} send={send} busy={busy} />
            ))}
          </ul>
          <p className="border-t border-white/[0.06] px-4 py-3 text-[12px] leading-relaxed text-[#8E8E8E] lg:px-5">
            As alterações vão para uma fila e o script do Google Ads aplica: em cerca de 1 minuto enquanto ele está rodando, no máximo em 1 hora. Pedidos não aplicados em 24 horas expiram.
          </p>
        </>
      )}
      <Changes commands={commands} cancel={cancel} busy={busy} />
    </Panel>
  );
}
