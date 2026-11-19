import React, { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { isRadarEnabled, track } from "@/lib/radar";
import { submitLead } from "@/lib/radar/submitLead";
import { isRescuable, rescueLead, clearPendingLead } from "@/lib/radar/pendingLead";
import { modalFormId } from "@/lib/leadCapture";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { trackLeadFormSubmitAttempt, trackWhatsAppClick } from "@/lib/tracking";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPhoneBR, normalizePhoneBR, validateLead, ERRORS } from "@/lib/leadValidation";

// Same id the RD Station form had: GTM's current form triggers keep firing (Plano 3 migrates them).
export const FORM_ID = "conversion-form-espontone";
// The capture modal's form: the id still contains FORM_ID, so the GTM "contains" trigger fires.
export const MODAL_FORM_ID = `${FORM_ID}-modal`;
const FIELD_ORDER = ["name", "phone", "email"];
// The modal opens on a click, so "time since the form appeared" would flag a fast autofill (< 2 s)
// as a bot; there the elapsed time counts from the page load instead.
const PAGE_START = (() => {
  const t = typeof performance !== "undefined" ? performance.timeOrigin : NaN;
  return Number.isFinite(t) && t > 0 ? t : Date.now();
})();
const INTENTS = [
  { value: "morar", label: "Morar" },
  { value: "investir", label: "Investir" },
];
const SERVER_FIELD_ERRORS = { invalid_name: "name", invalid_phone: "phone", invalid_email: "email" };
const FIELD_MESSAGES = { name: ERRORS.nameShort, phone: ERRORS.phone, email: ERRORS.email };
const FAILURE_MESSAGES = {
  rate_limited: "Recebemos muitos envios deste aparelho. Fale com um corretor pelo WhatsApp.",
  timeout: "O envio está demorando mais que o normal. Fale com um corretor pelo WhatsApp.",
  default: "Não foi possível enviar seus dados agora. Fale com um corretor pelo WhatsApp.",
};

// The prefilled chat (name/phone) is only ever passed to window.open at click time; the rendered
// href stays generic so GA4 outbound clicks and Clarity never capture the lead's data.
const GENERIC_WA_URL = buildWhatsAppUrl("Oi! Quero receber as tabelas do lançamento em SBC.");

function waMessage({ name, phone, intent }) {
  const lines = [`Oi! Meu nome é ${name}. Quero receber as tabelas do lançamento em SBC.`, `Meu WhatsApp: ${phone}.`];
  if (intent) lines.push(`Objetivo: ${intent}.`);
  return lines.join("\n");
}

// variant "full": the bottom form (name, WhatsApp, e-mail, intent).
// variant "compact": the capture modal (name + WhatsApp only); `source` = the CTA that opened it.
// onSendingChange(bool) lets the modal refuse to close while the lead is in flight.
const LeadForm = ({ variant = "full", source = "site", onSendingChange }) => {
  const compact = variant === "compact";
  const elementId = compact ? MODAL_FORM_ID : FORM_ID;
  const navigate = useNavigate();
  const uid = useId();
  const id = (f) => `${uid}-${f}`;

  const [values, setValues] = useState({ name: "", phone: "", email: "" });
  const [intent, setIntent] = useState("");
  const [errors, setErrors] = useState({});
  const [validated, setValidated] = useState(false); // after the first attempt, errors update live
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: "error" | "fallback", message, url }

  const fieldRefs = { name: useRef(null), phone: useRef(null), email: useRef(null) };
  const hpRef = useRef(null);
  const lockRef = useRef(false); // synchronous guard: double click / Enter + click = one submission
  const openedAt = useRef(compact ? PAGE_START : Date.now());
  const mounted = useRef(false);
  useEffect(() => {
    // Set in the body too: StrictMode (dev) runs mount -> cleanup -> mount on the same refs.
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const update = (field, raw) => {
    let value = raw;
    if (field === "phone") {
      const digits = (str) => str.replace(/\D/g, "");
      const prev = values.phone;
      // Backspace over a mask character ("-", ")", " ") removes the digit before it.
      const deletedMaskChar = raw.length < prev.length && digits(raw) === digits(prev);
      // One more keystroke on a complete number is ignored (a paste is a bigger change and still
      // goes through the mask, which strips a pasted +55).
      const oneCharInserted = raw.length === prev.length + 1 &&
        [...raw].some((_, i) => raw.slice(0, i) + raw.slice(i + 1) === prev);
      const typedPastFull = digits(prev).length === 11 && oneCharInserted;
      value = typedPastFull ? prev : formatPhoneBR(deletedMaskChar ? digits(raw).slice(0, -1) : raw);
    }
    const next = { ...values, [field]: value };
    setValues(next);
    if (validated) setErrors(validateLead(next));
  };

  const focusFirst = (errs) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first && fieldRefs[first].current) fieldRefs[first].current.focus();
  };

  // The native submit only happens with valid data: GTM's legacy form trigger is still the
  // Google Ads conversion, and a tap on a half-empty form must not count. Enter in a field clicks
  // this button too, so both paths stop here. Radar's collector only sees native submits, so the
  // failed attempt is recorded here (field names only, never values).
  const onSubmitClick = (e) => {
    if (lockRef.current) { e.preventDefault(); return; }
    trackLeadFormSubmitAttempt();
    const errs = validateLead(values);
    const invalid = FIELD_ORDER.filter((f) => errs[f]);
    if (!invalid.length) return; // -> native submit -> onSubmit
    e.preventDefault();
    setErrors(errs);
    setValidated(true);
    focusFirst(errs);
    track("form_submit_attempt", { form_id: elementId, invalid });
  };

  const onSubmit = async (e) => {
    // GTM's document listeners still receive this submit event; we only stop the page reload.
    e.preventDefault();
    if (lockRef.current) return;

    const errs = validateLead(values);
    setErrors(errs);
    setValidated(true);
    if (Object.keys(errs).length) {
      focusFirst(errs);
      return;
    }

    lockRef.current = true;
    setNotice(null);
    const lead = {
      name: values.name.trim(),
      phone: normalizePhoneBR(values.phone),
      email: values.email.trim(),
      intent,
      formId: compact ? modalFormId(source) : FORM_ID,
      hp: hpRef.current ? hpRef.current.value : "",
      elapsedMs: Math.round(Date.now() - openedAt.current), // PAGE_START (timeOrigin) is fractional
    };
    const url = buildWhatsAppUrl(waMessage({ ...lead, phone: values.phone }));

    if (!isRadarEnabled()) {
      // No lead backend configured: hand the lead straight to the brokers on WhatsApp.
      setNotice({ kind: "fallback", message: "Abrindo o WhatsApp com seus dados…", url });
      trackWhatsAppClick("lead_form_fallback", {
        onComplete: () => {
          lockRef.current = false;
          window.open(url, "_self");
        },
      });
      return;
    }

    setSending(true);
    if (onSendingChange) onSendingChange(true);
    const result = await submitLead(lead);
    // Both branches below run even if the form was unmounted meanwhile: the lead is never dropped.
    if (result.ok) {
      clearPendingLead();
      navigate("/obrigado"); // lock stays on: the form is leaving (navigate stays valid after unmount)
      return;
    }
    // No definitive answer from the server: beacon + one retry on the next load (pendingLead.js).
    if (isRescuable(result.error)) rescueLead(lead);
    if (onSendingChange) onSendingChange(false);
    if (!mounted.current) return;
    lockRef.current = false;
    setSending(false);
    const field = SERVER_FIELD_ERRORS[result.error];
    if (field) {
      const serverErrs = { [field]: FIELD_MESSAGES[field] };
      setErrors(serverErrs);
      focusFirst(serverErrs);
      return;
    }
    setNotice({ kind: "error", message: FAILURE_MESSAGES[result.error] || FAILURE_MESSAGES.default, url });
  };

  // Opens the prefilled chat; if the browser blocks the window, the generic href is followed instead.
  const openChat = (e) => {
    if (notice.kind === "error") trackWhatsAppClick("lead_form_error");
    const w = window.open(notice.url, "_blank");
    if (w) {
      try { w.opener = null; } catch (err) { /* ignore */ }
      e.preventDefault();
    }
  };

  const fieldProps = (field) => ({
    id: id(field),
    name: field,
    ref: fieldRefs[field],
    value: values[field],
    onChange: (ev) => update(field, ev.target.value),
    "aria-invalid": errors[field] ? "true" : "false",
    "aria-describedby": errors[field] ? id(`${field}-error`) : undefined,
    className: `form-input !text-base min-h-[48px] ${errors[field] ? "!border-[#E8877E] focus:!shadow-[0_0_0_3px_rgba(232,135,126,.18)]" : ""}`,
  });

  const fieldError = (field) =>
    errors[field] ? (
      <p id={id(`${field}-error`)} className="mt-1.5 text-[0.78rem] leading-snug text-[#F4B1AA] font-sans">
        {errors[field]}
      </p>
    ) : null;

  const labelCls = "block mb-1.5 font-sans text-[0.8rem] font-semibold text-[#F0F5FA]/90";
  const optional = <span className="font-normal text-[#F0F5FA]/55"> (opcional)</span>;

  return (
    <form id={elementId} data-radar-native="" method="post" noValidate onSubmit={onSubmit} className="space-y-3.5 text-left">
      <div>
        <label htmlFor={id("name")} className={labelCls}>Nome</label>
        <input {...fieldProps("name")} type="text" autoComplete="name" autoCapitalize="words" placeholder="Como podemos te chamar?" maxLength={120} />
        {fieldError("name")}
      </div>

      <div>
        <label htmlFor={id("phone")} className={labelCls}>WhatsApp</label>
        <input {...fieldProps("phone")} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 99999-9999" />
        {fieldError("phone")}
      </div>

      {!compact && <div>
        <label htmlFor={id("email")} className={labelCls}>E-mail{optional}</label>
        <input {...fieldProps("email")} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="nome@email.com" />
        {fieldError("email")}
      </div>}

      {!compact && <fieldset>
        <legend className={labelCls}>Você pretende{optional}</legend>
        <div className="form-radio-group">
          {INTENTS.map((o) => (
            <label
              key={o.value}
              className={`form-radio min-h-[44px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7DB4E8] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[#0A1930] ${intent === o.value ? "active" : ""}`}
            >
              <input
                type="radio"
                name="intent"
                value={o.value}
                checked={intent === o.value}
                onChange={() => setIntent(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>}

      {/* Honeypot: invisible to people and assistive tech; bots that fill every input reveal themselves. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor={id("hpt")}>Não preencha este campo</label>
        <input id={id("hpt")} ref={hpRef} name="hpt" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`animate-in fade-in-0 slide-in-from-top-1 duration-300 rounded-xl border p-3.5 font-sans text-[0.85rem] leading-snug ${
            notice.kind === "error"
              ? "border-[#E8877E]/40 bg-[#E8877E]/[0.08] text-[#F7CBC6]"
              : "border-[#5B95CE]/35 bg-[#5B95CE]/[0.08] text-[#F0F5FA]/90"
          }`}
        >
          <p>{notice.message}</p>
          <a
            href={GENERIC_WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openChat}
            className="btn-whatsapp !mt-3 !flex min-h-[48px] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <WhatsAppIcon size={18} />
            Falar no WhatsApp
          </a>
        </div>
      )}

      <button
        type="submit"
        onClick={onSubmitClick}
        disabled={sending}
        aria-busy={sending ? "true" : "false"}
        className={`${!compact ? "btn-gold" : notice ? "btn-secondary-outline" : "btn-whatsapp"} w-full min-h-[52px] !mt-5 disabled:cursor-wait disabled:opacity-80 disabled:!transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1930]`}
      >
        {sending ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Enviando…
          </>
        ) : compact && notice ? (
          "Tentar novamente" // the chat link above is the primary action now
        ) : compact ? (
          <>
            <WhatsAppIcon size={20} />
            Seguir para o atendimento
          </>
        ) : (
          "Receber as tabelas"
        )}
      </button>

      <p className="text-center font-sans text-[0.72rem] leading-relaxed text-[#F0F5FA]/60">
        Ao enviar, você concorda em ser contatado pela Espontone sobre este lançamento, conforme nossa{" "}
        <a href="/privacidade" className="text-[#7DB4E8] underline underline-offset-2 hover:text-[#F0F5FA]">Política de Privacidade</a>.
      </p>
    </form>
  );
};

export default LeadForm;
