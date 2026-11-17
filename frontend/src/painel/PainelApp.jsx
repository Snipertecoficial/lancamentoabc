import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useNoIndex } from "./noindex";
import { usePanelTitle, useViewportFitCover } from "./head";
import { EnvProvider } from "./EnvContext";
import RequireAdmin from "./RequireAdmin";
import Layout from "./Layout";
import LeadsPage from "./pages/LeadsPage";
import LeadPage from "./pages/LeadPage";
import AoVivoPage from "./pages/AoVivoPage";
import AnunciosPage from "./pages/AnunciosPage";

// The funnel brings Recharts: its own chunk, loaded only when the screen opens.
const FunilPage = lazy(() => import("./pages/FunilPage"));

export default function PainelApp() {
  useNoIndex();
  usePanelTitle();
  useViewportFitCover();
  return (
    <EnvProvider>
      <RequireAdmin>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LeadsPage />} />
            <Route path="leads/:id" element={<LeadPage />} />
            <Route path="funil" element={<Suspense fallback={<p className="text-[14px] text-[#8E8E8E]">Carregando o funil…</p>}><FunilPage /></Suspense>} />
            <Route path="anuncios" element={<AnunciosPage />} />
            <Route path="ao-vivo" element={<AoVivoPage />} />
            <Route path="*" element={<Navigate to="/painel" replace />} />
          </Route>
        </Routes>
      </RequireAdmin>
    </EnvProvider>
  );
}
