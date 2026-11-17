import React from "react";
import { Routes, Route, Navigate, Link, useParams } from "react-router-dom";
import { useNoIndex } from "./noindex";
import { EnvProvider } from "./EnvContext";
import RequireAdmin from "./RequireAdmin";
import Layout from "./Layout";

// Placeholders until the Leads, Lead, Funil and Ao vivo screens land.
function Placeholder({ title, children }) {
  return (
    <section>
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-white">{title}</h1>
      <p className="mt-2 max-w-prose text-[15px] text-[#B8BEC5]">{children}</p>
    </section>
  );
}

function LeadPlaceholder() {
  const { id } = useParams();
  return (
    <>
      <Link to="/painel" className="text-sm text-[#7DB4E8] hover:underline">Voltar para leads</Link>
      <div className="mt-4">
        <Placeholder title="Lead">A linha do tempo do lead {id} aparece aqui.</Placeholder>
      </div>
    </>
  );
}

export default function PainelApp() {
  useNoIndex();
  return (
    <EnvProvider>
      <RequireAdmin>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Placeholder title="Leads">A lista de leads, com origem, estágio e temperatura, aparece aqui.</Placeholder>} />
            <Route path="leads/:id" element={<LeadPlaceholder />} />
            <Route path="funil" element={<Placeholder title="Funil & Campanhas">As etapas do funil e o desempenho de cada campanha aparecem aqui.</Placeholder>} />
            <Route path="ao-vivo" element={<Placeholder title="Ao vivo">Quem está no site agora aparece aqui.</Placeholder>} />
            <Route path="*" element={<Navigate to="/painel" replace />} />
          </Route>
        </Routes>
      </RequireAdmin>
    </EnvProvider>
  );
}
