import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import EspontoneLogo from "@/components/EspontoneLogo";
import { signIn, useAdminSession } from "./auth";
import { useNoIndex } from "./noindex";
import { usePanelTitle } from "./head";
import Scope from "./Scope";

const field =
  "h-11 w-full rounded-lg border border-white/[0.12] bg-[#061224] px-3.5 text-[15px] text-white " +
  "transition-colors focus:border-[#7DB4E8] focus:outline-none focus:ring-2 focus:ring-[#7DB4E8]/30";

export default function LoginPage() {
  useNoIndex();
  usePanelTitle();
  const { status } = useAdminSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "admin") return <Navigate to="/painel" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await signIn(email.trim(), password);
    if (r.ok) {
      navigate("/painel", { replace: true });
      return;
    }
    setError(r.error);
    setBusy(false);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#061224] px-4 py-12 text-[#F0F5FA]">
      <Scope />
      <div className="relative w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center">
          <EspontoneLogo />
          <h1 className="mt-8 font-display text-[40px] font-semibold leading-none tracking-tight">Radar</h1>
          <p className="mt-3 text-balance text-[15px] text-[#B8BEC5]">Leads da página de lançamento, da origem ao WhatsApp.</p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-9 rounded-2xl border border-white/[0.08] bg-[#0A1930]/85 p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-7"
        >
          <label htmlFor="painel-email" className="block text-sm font-medium text-[#E8EEF5]">E-mail</label>
          <input
            id="painel-email"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${field} mt-2`}
          />

          <label htmlFor="painel-senha" className="mt-5 block text-sm font-medium text-[#E8EEF5]">Senha</label>
          <div className="relative mt-2">
            <input
              id="painel-senha"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${field} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[#8E8E8E] hover:text-white focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[#7DB4E8]"
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-[#E57373]/30 bg-[#E57373]/10 px-3.5 py-2.5 text-sm text-[#F4B4B4]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="mt-6 h-11 w-full rounded-lg bg-[#3A70A3] text-[15px] font-semibold text-white transition-colors hover:bg-[#5B95CE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1930] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center">
          <Link to="/" className="text-sm text-[#8E8E8E] underline-offset-4 hover:text-[#B8BEC5] hover:underline">
            Voltar ao site
          </Link>
        </p>
      </div>
    </main>
  );
}
