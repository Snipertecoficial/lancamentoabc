import React, { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageCircle } from "lucide-react";
import { isRadarEnabled } from "@/lib/radar";
import { submitLead } from "@/lib/radar/submitLead";
import { trackLeadFormSubmitAttempt, trackWhatsAppClick } from "@/lib/tracking";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatPhoneBR, normalizePhoneBR, validateLead, ERRORS } from "@/lib/leadValidation";

// Same id the RD Station form had: GTM's current form triggers keep firing (Plano 3 migrates them).
export const FORM_ID = "conversion-form-espontone";
const FIELD_ORDER = ["name", "phone", "email"];
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

function waMessage({ name, phone, email, intent }) {
  const lines = [`Oi! Meu nome é ${name}. Quero receber as tabelas do lançamento em SBC.`, `Meu WhatsApp: ${phone}.`];
  if (email) lines.push(`E-mail: ${email}.`);
  if (intent) lines.push(`Objetivo: ${intent}.`);
  return lines.join("\n");
}

const LeadForm = () => {
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
  const openedAt = useRef(Date.now());
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const update = (field, raw) => {
    let value = raw;
    if (field === "phone") {
      const digits = (str) => str.replace(/\D/g, "");
      // Backspace over a mask character ("-", ")", " ") removes the digit before it.
      const deletedMaskChar = raw.length < values.phone.length && digits(raw) === digits(values.phone);
      value = formatPhoneBR(deletedMaskChar ? digits(raw).slice(0, -1) : raw);
    }
    const next = { ...values, [field]: value };
    setValues(next);
    if (validated) setErrors(validateLead(next));
  };

  const focusFirst = (errs) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first && fieldRefs[first].current) fieldRefs[first].current.focus();
  };

  const onSubmit = async (e) => {
    // GTM's document listeners still receive this submit event; we only stop the page reload.
    e.preventDefault();
    if (lockRef.current) return;
    trackLeadFormSubmitAttempt();

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
      formId: FORM_ID,
      hp: hpRef.current ? hpRef.current.value : "",
      elapsedMs: Date.now() - openedAt.current,
    };
    const url = buildWhatsAppUrl(waMessage({ ...lead, phone: values.phone }));

    if (!isRadarEnabled()) {
      // No lead backend configured: hand the lead straight to the brokers on WhatsApp.
      setNotice({ kind: "fallback", message: "Abrindo o WhatsApp com seus dados…", url });
      trackWhatsAppClick("lead_form_fallback", {
        onComplete: () => {
          lockRef.current = false;
          window.location.href = url;
        },
      });
      return;
    }

    setSending(true);
    const result = await submitLead(lead);
    if (!mounted.current) return;
    if (result.ok) {
      navigate("/obrigado"); // lock stays on: the form is leaving
      return;
    }
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
    <form id={FORM_ID} data-radar-native="" noValidate onSubmit={onSubmit} className="space-y-3.5 text-left">
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

      <div>
        <label htmlFor={id("email")} className={labelCls}>E-mail{optional}</label>
        <input {...fieldProps("email")} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="nome@email.com" />
        {fieldError("email")}
      </div>

      <fieldset>
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
      </fieldset>

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
            href={notice.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={notice.kind === "error" ? () => trackWhatsAppClick("lead_form_error") : undefined}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 font-semibold text-white transition-colors hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <MessageCircle size={18} aria-hidden="true" />
            Falar no WhatsApp
          </a>
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending ? "true" : "false"}
        className="btn-gold w-full min-h-[52px] !mt-5 disabled:cursor-wait disabled:opacity-80 disabled:!transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1930]"
      >
        {sending ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Enviando…
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
