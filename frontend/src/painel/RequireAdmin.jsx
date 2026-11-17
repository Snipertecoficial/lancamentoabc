import React, { createContext, useContext } from "react";
import { Navigate, Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { useAdminSession } from "./auth";
import Scope from "./Scope";

const AdminUserContext = createContext(null);
export const useAdminUser = () => useContext(AdminUserContext);

function Loading() {
  const bar = "animate-pulse rounded-md bg-white/[0.05]";
  return (
    <div data-testid="painel-loading" aria-busy="true" className="min-h-screen bg-[#0A1930] lg:flex">
      <span className="sr-only">Carregando o painel…</span>
      <div className="hidden w-60 shrink-0 border-r border-white/[0.06] bg-[#061224] p-5 lg:block">
        <div className={`${bar} h-9 w-28`} />
        <div className="mt-10 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className={`${bar} h-8`} />)}
        </div>
      </div>
      <div className="flex-1 p-4 lg:p-8">
        <div className={`${bar} h-8 w-48`} />
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`${bar} h-12`} />)}
        </div>
      </div>
    </div>
  );
}

function Denied() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#061224] px-4 text-[#F0F5FA]">
      <Scope />
      <div className="relative w-full max-w-sm text-center">
        <ShieldX className="mx-auto h-10 w-10 text-[#7DB4E8]" strokeWidth={1.5} aria-hidden="true" />
        <h1 className="mt-5 font-display text-3xl font-semibold">Acesso não autorizado</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#B8BEC5]">
          Esta conta não tem permissão para ver o painel. A sessão foi encerrada.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex h-11 items-center rounded-lg border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-[#7DB4E8] hover:text-[#7DB4E8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]"
        >
          Entrar com outra conta
        </Link>
      </div>
    </main>
  );
}

export default function RequireAdmin({ children }) {
  const { status, user } = useAdminSession();
  if (status === "loading") return <Loading />;
  if (status === "anon") return <Navigate to="/login" replace />;
  if (status !== "admin") return <Denied />;
  return <AdminUserContext.Provider value={user}>{children}</AdminUserContext.Provider>;
}
