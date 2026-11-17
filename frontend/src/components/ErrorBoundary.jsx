import React from "react";

// Last line of defence for every route (LP and panel): a failed lazy chunk or a module that throws
// on load shows a reload screen instead of a blank page.
const KEY = "app-chunk-reload-at";
const RELOAD_GUARD_MS = 60000; // at most one automatic reload per minute, so a broken deploy cannot loop

function isChunkError(error) {
  return !!error && (error.name === "ChunkLoadError" || /Loading (CSS )?chunk \S+ failed/i.test(error.message || ""));
}

// A stale tab after a deploy asks for chunk files that no longer exist: one fresh load fixes it.
function reloadOnceForChunk(error) {
  if (!isChunkError(error)) return;
  try {
    const last = Number(sessionStorage.getItem(KEY)) || 0;
    if (Date.now() - last < RELOAD_GUARD_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch (e) {
    return; // without storage there is no loop guard, so leave it to the button
  }
  window.location.reload();
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    reloadOnceForChunk(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main role="alert" className="flex min-h-screen flex-col items-center justify-center bg-[#0A1930] px-6 text-center text-[#F0F5FA]">
        <h1 className="font-display text-3xl font-semibold">Algo deu errado</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#B8BEC5]">
          A página não carregou por completo. Recarregue para tentar de novo.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 h-11 rounded-lg bg-[#3A70A3] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#5B95CE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1930]"
        >
          Recarregar página
        </button>
      </main>
    );
  }
}
