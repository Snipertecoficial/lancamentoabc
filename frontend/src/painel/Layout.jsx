import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Users, Filter, Radio, LogOut, Menu, X } from "lucide-react";
import { signOut } from "./auth";
import { useAdminUser } from "./RequireAdmin";
import { useEnv, ENV_OPTIONS } from "./EnvContext";

const NAV = [
  { to: "/painel", label: "Leads", icon: Users, match: (p) => p === "/painel" || p === "/painel/" || p.startsWith("/painel/leads") },
  { to: "/painel/funil", label: "Funil & Campanhas", icon: Filter, match: (p) => p.startsWith("/painel/funil") },
  { to: "/painel/ao-vivo", label: "Ao vivo", icon: Radio, match: (p) => p.startsWith("/painel/ao-vivo") },
];

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";

function Brand() {
  return (
    <Link to="/painel" className={`flex items-center gap-3 rounded-lg ${focusRing}`}>
      <span className="flex h-9 items-center rounded-lg bg-white px-2">
        <img src="/logo-ofc.png" alt="Espontone Imóveis" className="h-7 w-auto" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-white">Radar</span>
    </Link>
  );
}

function EnvSwitch() {
  const { env, setEnv } = useEnv();
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="hidden text-[13px] text-[#8E8E8E] sm:inline">Dados de</span>
      <div role="radiogroup" aria-label="Ambiente dos dados" className="flex rounded-lg border border-white/10 bg-[#061224] p-0.5">
        {ENV_OPTIONS.map((o) => {
          const on = env === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setEnv(o.value)}
              className={`h-8 rounded-md px-3 text-[13px] font-medium transition-colors ${focusRing} ${
                on ? "bg-[#12294A] text-white shadow-[inset_0_0_0_1px_rgba(125,180,232,0.35)]" : "text-[#8E8E8E] hover:text-[#E8EEF5]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Sidebar({ pathname, onSignOut }) {
  const user = useAdminUser();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-8 pt-5">
        <Brand />
      </div>
      <nav aria-label="Painel" className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors ${focusRing} ${
                active ? "bg-white/[0.06] text-white" : "text-[#B8BEC5] hover:bg-white/[0.03] hover:text-white"
              }`}
            >
              {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#7DB4E8]" />}
              <Icon className={`h-[18px] w-[18px] ${active ? "text-[#7DB4E8]" : ""}`} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] p-3">
        {user && user.email && <p className="truncate px-3 pb-2 text-xs text-[#8E8E8E]" title={user.email}>{user.email}</p>}
        <button
          type="button"
          onClick={onSignOut}
          className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-[#B8BEC5] transition-colors hover:bg-white/[0.03] hover:text-white ${focusRing}`}
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
          Sair
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const onSignOut = async () => {
    await signOut("global");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0A1930] text-[#F0F5FA] lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-white/[0.06] bg-[#061224] lg:block">
        <Sidebar pathname={pathname} onSignOut={onSignOut} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <button type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-[#061224]/70 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-white/[0.06] bg-[#061224] shadow-2xl">
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
              className={`absolute right-3 top-5 flex h-9 w-9 items-center justify-center rounded-lg text-[#B8BEC5] hover:text-white ${focusRing}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <Sidebar pathname={pathname} onSignOut={onSignOut} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0A1930]/90 px-4 backdrop-blur lg:justify-end lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className={`-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-[#B8BEC5] hover:text-white ${focusRing}`}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="font-display text-lg font-semibold tracking-tight">Radar</span>
          </div>
          <EnvSwitch />
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
