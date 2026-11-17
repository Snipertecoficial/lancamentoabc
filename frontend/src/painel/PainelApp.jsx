import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useNoIndex } from "./noindex";
import { EnvProvider } from "./EnvContext";
import RequireAdmin from "./RequireAdmin";
import Layout from "./Layout";
import LeadsPage from "./pages/LeadsPage";
import LeadPage from "./pages/LeadPage";

// Placeholders until the Funil and Ao vivo screens land.
function Placeholder({ title, children }) {
  return (
    <section>
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-white">{title}</h1>
      <p className="mt-2 max-w-prose text-[15px] text-[#B8BEC5]">{children}</p>
    </section>
  );
}

export default function PainelApp() {
  useNoIndex();
  return (
    <EnvProvider>
      <RequireAdmin>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LeadsPage />} />
            <Route path="leads/:id" element={<LeadPage />} />
            <Route path="funil" element={<Placeholder title="Funil & Campanhas">As etapas do funil e o desempenho de cada campanha aparecem aqui.</Placeholder>} />
            <Route path="ao-vivo" element={<Placeholder title="Ao vivo">Quem está no site agora aparece aqui.</Placeholder>} />
            <Route path="*" element={<Navigate to="/painel" replace />} />
          </Route>
        </Routes>
      </RequireAdmin>
    </EnvProvider>
  );
}
