import { STORAGE_KEYS } from "@/lib/storage-keys";

export const DEFAULT_CALENDAR_PORTFOLIO_ID = "default";

export type CalendarPortfolio = {
  id: string;
  name: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function sanitizeCalendarPortfolioId(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9가-힣_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return base || `portfolio-${Date.now().toString(36)}`;
}

export function normalizeCalendarPortfolioName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 48);
}

export function ensureDefaultCalendarPortfolio(portfolios: CalendarPortfolio[]): CalendarPortfolio[] {
  const map = new Map<string, CalendarPortfolio>();
  map.set(DEFAULT_CALENDAR_PORTFOLIO_ID, { id: DEFAULT_CALENDAR_PORTFOLIO_ID, name: "default" });
  for (const p of portfolios) if (p.id && p.name) map.set(p.id, p);
  return Array.from(map.values()).sort((a, b) => (a.id === DEFAULT_CALENDAR_PORTFOLIO_ID ? -1 : b.id === DEFAULT_CALENDAR_PORTFOLIO_ID ? 1 : a.name.localeCompare(b.name)));
}

export function getCalendarLocalStorageKey(kind: "tickerList" | "cache" | "customEvents" | "eventMetas", portfolioId: string): string {
  return `calendar:${kind}:${portfolioId || DEFAULT_CALENDAR_PORTFOLIO_ID}`;
}

export function getLegacyCalendarLocalStorageKey(kind: "tickerList" | "cache" | "customEvents" | "eventMetas"): string {
  if (kind === "tickerList") return STORAGE_KEYS.calendarTickers;
  if (kind === "cache") return STORAGE_KEYS.calendarCache;
  if (kind === "customEvents") return STORAGE_KEYS.calendarCustomEvents;
  return STORAGE_KEYS.calendarEventMeta;
}
