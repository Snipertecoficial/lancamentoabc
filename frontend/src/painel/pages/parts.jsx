import React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Building blocks shared by the report screens (Funil, Anúncios).
const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8]";

export function Panel({ label, title, aside, children, className = "" }) {
  return (
    <section aria-label={label} className={`overflow-hidden rounded-xl border border-white/[0.06] bg-[#061224]/50 ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-1 pt-4 lg:px-5 lg:pt-5">
        <h2 className="font-display text-[20px] font-semibold tracking-tight text-white lg:text-[22px]">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function LoadError({ what, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-4 py-8 lg:px-5">
      <p className="text-[15px] font-medium text-white">{`Não foi possível carregar ${what}.`}</p>
      <p className="text-[14px] text-[#B8BEC5]">Verifique a conexão e tente de novo.</p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        className={`h-11 rounded-lg border-white/15 bg-transparent text-[15px] text-[#E8EEF5] hover:bg-white/[0.04] hover:text-white md:h-9 md:text-[13px] ${focusRing}`}
      >
        <RotateCw aria-hidden="true" />
        Tentar de novo
      </Button>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="px-4 py-12 text-center lg:px-5">
      <p className="font-display text-[20px] text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[14px] text-[#B8BEC5]">{children}</p>
    </div>
  );
}
