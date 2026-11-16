const BOT_RE = /bot|crawl|spider|headless|lighthouse|preview|facebookexternalhit/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}
