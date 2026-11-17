// Traffic origin as computed by public.panel_origin(): labels and colors for the panel.
export const ORIGINS = [
  { value: "google_ads", label: "Google Ads", color: "#7DB4E8" },
  { value: "meta_ads", label: "Meta Ads", color: "#B3A4E6" },
  { value: "organic_search", label: "Busca orgânica", color: "#86C9A8" },
  { value: "direct", label: "Direto", color: "#B8BEC5" },
  { value: "other", label: "Outros", color: "#8A94A3" },
];

export const AD_ORIGINS = ["google_ads", "meta_ads"];

const byValue = Object.fromEntries(ORIGINS.map((o) => [o.value, o]));
const find = (origin) => byValue[origin] || byValue.other;

export function originLabel(origin) {
  return find(origin).label;
}

export function originTone(origin) {
  return find(origin).color;
}
