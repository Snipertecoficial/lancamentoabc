function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

export function isAllowedOrigin(origin: string | null, patterns: string[]): boolean {
  if (!origin) return false;
  return patterns.some((p) => patternToRegExp(p).test(origin));
}

export function corsHeaders(origin: string | null, patterns: string[]): Headers {
  const h = new Headers();
  if (origin && isAllowedOrigin(origin, patterns)) {
    h.set("access-control-allow-origin", origin);
    h.set("access-control-allow-methods", "POST, OPTIONS");
    h.set("access-control-allow-headers", "content-type");
    h.set("access-control-max-age", "86400");
    h.set("vary", "Origin");
  }
  return h;
}
