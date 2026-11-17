// Helpers for the "Ao vivo" screen (panel_sessions_live).
import { sectionLabel } from "./eventLabels";

export function liveSection(section) {
  if (!section) return "";
  return sectionLabel(section) || "Outra parte da página";
}
