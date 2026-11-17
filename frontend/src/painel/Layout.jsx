import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Users, Filter, Megaphone, Radio, LogOut, Menu, X, ChevronLeft } from "lucide-react";
import { signOut } from "./auth";
import { useAdminUser } from "./RequireAdmin";
import { useEnv, ENV_OPTIONS } from "./EnvContext";
import { useOverlay } from "./useOverlay";

const NAV = [
  { to: "/painel", label: "Leads", icon: Users, match: (p) => p === "/painel" || p === "/painel/" || p.startsWith("/painel/leads") },
  { to: "/painel/funil", label: "Funil & Campanhas", bar: "Funil", icon: Filter, match: (p) => p.startsWith("/painel/funil") },
  { to: "/painel/anuncios", label: "Anúncios", icon: Megaphone, match: (p) => p.startsWith("/painel/anuncios") },
  { to: "/painel/ao-vivo", label: "Ao vivo", icon: Radio, match: (p) => p.startsWith("/painel/ao-vivo") },
];

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";

// Compact top bar (below lg): the current section's name, or a way back from a lead.
function barFor(pathname) {
  if (pathname.startsWith("/painel/leads/")) return { title: "Lead", back: { to: "/painel", label: "Leads" } };
  const item = NAV.find((n) => n.match(pathname));
  return { title: item ? item.bar || item.label : "Radar", back: null };
}

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
          // Test data gets an amber tint so it is never mistaken for the real numbers.
          const onTone = o.value === "staging"
            ? "bg-[#D9BB78]/15 text-[#E9CF93] shadow-[inset_0_0_0_1px_rgba(217,187,120,0.4)]"
            : "bg-[#12294A] text-white shadow-[inset_0_0_0_1px_rgba(125,180,232,0.35)]";
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setEnv(o.value)}
              className={`relative h-9 rounded-md px-2.5 text-[13px] font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] sm:px-3 lg:h-8 ${focusRing} ${
                on ? onTone : "text-[#8E8E8E] hover:text-[#E8EEF5]"
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
              className={`relative flex h-12 items-center gap-3 rounded-lg px-3 text-[16px] font-medium transition-colors lg:h-10 lg:text-[14px] ${focusRing} ${
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
          className={`flex h-12 w-full items-center gap-3 rounded-lg px-3 text-[16px] font-medium text-[#B8BEC5] transition-colors hover:bg-white/[0.03] hover:text-white lg:h-10 lg:text-[14px] ${focusRing}`}
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

  const drawer = useRef(null);
  const drawerClose = useRef(null);
  const menuButton = useRef(null);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  // Modal drawer: focus in and back to the menu button, Tab kept inside, Escape closes, and it
  // closes on its own once the viewport reaches the desktop sidebar (lg, 1024px).
  useOverlay({
    open: menuOpen,
    onClose: () => setMenuOpen(false),
    containerRef: drawer,
    initialFocusRef: drawerClose,
    returnFocusRef: menuButton,
    closeAtQuery: "(min-width: 1024px)",
  });

  const onSignOut = async () => {
    await signOut("global");
    navigate("/login", { replace: true });
  };

  const bar = barFor(pathname);
  const sideInsets = "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";

  return (
    <div className="min-h-screen overflow-x-clip bg-[#0A1930] text-[16px] text-[#F0F5FA] lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-white/[0.06] bg-[#061224] lg:block">
        <Sidebar pathname={pathname} onSignOut={onSignOut} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <button
            type="button"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-[#061224]/70 backdrop-blur-sm duration-200 animate-in fade-in motion-reduce:animate-none"
          />
          <aside ref={drawer} className="absolute inset-y-0 left-0 w-[19rem] max-w-[86vw] border-r border-white/[0.06] bg-[#061224] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] shadow-2xl duration-200 animate-in slide-in-from-left motion-reduce:animate-none">
            <button
              ref={drawerClose}
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
              className={`absolute right-2 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-lg text-[#B8BEC5] hover:text-white ${focusRing}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <Sidebar pathname={pathname} onSignOut={onSignOut} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className={`sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A1930]/90 pt-[env(safe-area-inset-top)] backdrop-blur ${sideInsets} lg:px-8 lg:pt-0`}>
          <div className="flex h-14 items-center justify-between gap-2 lg:justify-end">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
              {bar.back ? (
                <Link
                  to={bar.back.to}
                  aria-label={`Voltar para ${bar.back.label}`}
                  className={`-ml-2 flex h-11 min-w-0 items-center gap-0.5 rounded-lg pr-2 text-[16px] font-medium text-[#7DB4E8] active:text-white ${focusRing}`}
                >
                  <ChevronLeft className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden="true" />
                  {bar.back.label}
                </Link>
              ) : (
                <>
                  <Link to="/painel" aria-label="Radar, início" className={`flex h-8 shrink-0 items-center rounded-md bg-white px-1.5 ${focusRing}`}>
                    <img src="/logo-ofc.png" alt="" className="h-6 w-6" />
                  </Link>
                  <p className="truncate font-display text-[19px] font-semibold tracking-tight text-white">{bar.title}</p>
                </>
              )}
            </div>
            <EnvSwitch />
            <button
              ref={menuButton}
              type="button"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#B8BEC5] hover:text-white lg:hidden ${focusRing}`}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className={`${sideInsets} pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5 lg:px-8 lg:py-8`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
