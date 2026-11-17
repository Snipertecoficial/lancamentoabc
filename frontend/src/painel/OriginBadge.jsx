import React from "react";
import { originLabel, originTone } from "./lib/origin";

// Traffic origin as a small badge with its color dot; label/color override the origin's own.
export default function OriginBadge({ origin, label, color }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[12px] font-medium text-[#E8EEF5]">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: color || originTone(origin) }} />
      {label || originLabel(origin)}
    </span>
  );
}
