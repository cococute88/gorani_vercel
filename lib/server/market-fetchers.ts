import "server-only";

import { fetchYahooChart, toIsoDate } from "@/lib/server/quote-fetchers";
import type { QuoteHistoryPrice } from "@/lib/quote-types";
import type { BriefingItem, EtfTemperature, FearGreedData, MarketRange, SeriesPoint } from "@/lib/market-data";

export type MarketWarning = { code: string; message: string };
export type MarketPayload = {
  source: "live" | "partial" | "unavailable";
  updatedAt: string | null;
  fearGreed: (FearGreedData & { source: string; updatedAt: string | null; error?: string }) | null;
  briefing: BriefingItem[];
  temperatures: EtfTemperature[];
  rsi: SeriesPoint[];
  drawdown: SeriesPoint[];
  vix: SeriesPoint[];
  warnings: MarketWarning[];
};

const WATCHLIST = ["QQQ", "SCHD", "SPY"] as const;
const BRIEFING_SYMBOLS = [
  { key: "sp500", label: "S&P 500", ticker: "^GSPC", digits: 2 },
  { key: "dow", label: "Dow Jones", ticker: "^DJI", digits: 2 },
  { key: "nasdaq", label: "Nasdaq", ticker: "^IXIC", digits: 2 },
  { key: "usdkrw", label: "USD/KRW", ticker: "KRW=X", digits: 2 },
  { key: "wti", label: "WTI", ticker: "CL=F", digits: 2, prefix: "$" },
  { key: "gold", label: "Gold", ticker: "GC=F", digits: 2, prefix: "$" },
  { key: "vix", label: "VIX", ticker: "^VIX", digits: 2 },
] as const;

const RANGE_TO_YAHOO: Record<MarketRange, string> = { "6개월": "6m", "1년": "1y", "3년": "3y", "5년": "5y", "전체": "5y" };
const CNN_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const CNN_TIMEOUT_MS = 8_000;

function nowIso() { return new Date().toISOString(); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function round(value: number, digits = 2) { return Number(value.toFixed(digits)); }
function formatValue(value: number, digits = 2, prefix = "") { return `${prefix}${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`; }
function toSafeIsoTimestamp(value: unknown): string | null {
  if (value == null) return null;
  const date = new Date(typeof value === "number" ? (value > 10_000_000_000 ? value : value * 1000) : String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchJsonWithTimeout(url: string, init: RequestInit & { next?: { revalidate: number } } = {}, timeoutMs = CNN_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function yahooPrices(payload: Awaited<ReturnType<typeof fetchYahooChart>>): QuoteHistoryPrice[] {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];
  return timestamps.flatMap((timestamp, index) => {
    const close = quote.close?.[index];
    if (!finite(close) || close <= 0) return [];
    return [{ date: toIsoDate(timestamp), close: round(close, 6), open: null, high: null, low: null, volume: null }];
  }).sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchPrices(ticker: string, range = "1y") {
  const payload = await fetchYahooChart({ ticker, range, events: "history" });
  return yahooPrices(payload);
}

export function calculateRsi14(prices: Array<{ date: string; close: number }>): Array<{ date: string; value: number }> {
  const rows = prices.filter((p) => finite(p.close) && p.close > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 15) return [];
  let gain = 0; let loss = 0;
  for (let i = 1; i <= 14; i++) {
    const diff = rows[i].close - rows[i - 1].close;
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  let avgGain = gain / 14;
  let avgLoss = loss / 14;
  const out: Array<{ date: string; value: number }> = [];
  const push = (idx: number) => {
    const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    out.push({ date: rows[idx].date, value: round(value, 2) });
  };
  push(14);
  for (let i = 15; i < rows.length; i++) {
    const diff = rows[i].close - rows[i - 1].close;
    avgGain = (avgGain * 13 + Math.max(diff, 0)) / 14;
    avgLoss = (avgLoss * 13 + Math.max(-diff, 0)) / 14;
    push(i);
  }
  return out;
}

export function calculateRollingDrawdown(prices: Array<{ date: string; close: number }>, window = 252): Array<{ date: string; value: number }> {
  const rows = prices.filter((p) => finite(p.close) && p.close > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length === 0) return [];
  return rows.map((row, index) => {
    const slice = rows.slice(Math.max(0, index - window + 1), index + 1);
    const high = Math.max(...slice.map((p) => p.close));
    return { date: row.date, value: round((row.close / high - 1) * 100, 2) };
  });
}

function mergeSeries(seriesByTicker: Record<string, Array<{ date: string; value: number }>>): SeriesPoint[] {
  const byDate = new Map<string, SeriesPoint>();
  for (const [ticker, rows] of Object.entries(seriesByTicker)) {
    for (const row of rows) {
      const point = byDate.get(row.date) ?? { date: row.date };
      point[ticker] = row.value;
      byDate.set(row.date, point);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function fetchFearGreed(): Promise<MarketPayload["fearGreed"]> {
  const json = await fetchJsonWithTimeout(CNN_URL, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0 market-data" }, next: { revalidate: 60 * 30 } }) as any;
  const current = json.fear_and_greed ?? json.fearGreed ?? json;
  const rawScore = current.score ?? current.value ?? current.rating;
  const score = typeof rawScore === "string" ? Number(rawScore) : rawScore;
  const rawUpdatedAt = current.timestamp ?? current.previous_close ?? current.updated_at ?? current.updatedAt ?? null;
  const historySource = json.fear_and_greed_historical?.data ?? json.fearGreedHistorical?.data ?? json.history ?? [];
  const history = (Array.isArray(historySource) ? historySource : []).flatMap((p: any) => {
    const value = Number(p.y ?? p.value ?? p.score);
    const x = p.x ?? p.date ?? p.timestamp;
    if (!finite(value) || x == null) return [];
    return [{ date: typeof x === "number" ? toIsoDate(x) : toIsoDate(String(x).slice(0, 10)), value: round(value, 2) }];
  }).slice(-370);
  if (!finite(score)) throw new Error("CNN Fear & Greed score missing");
  const updatedAt = toSafeIsoTimestamp(rawUpdatedAt) ?? nowIso();
  return { score: round(score, 0), history, source: "CNN Fear & Greed", updatedAt };
}

export async function buildMarketPayload(range: MarketRange = "1년"): Promise<MarketPayload> {
  const warnings: MarketWarning[] = [];
  const yahooRange = RANGE_TO_YAHOO[range] ?? "1y";
  let fearGreed: MarketPayload["fearGreed"] = null;
  try { fearGreed = await fetchFearGreed(); } catch (e) { warnings.push({ code: "fear_greed_unavailable", message: e instanceof Error ? e.message : String(e) }); }

  const briefing = (await Promise.all(BRIEFING_SYMBOLS.map(async (item) => {
    try {
      const prices = await fetchPrices(item.ticker, "1m");
      const latest = prices.at(-1); const prev = prices.at(-2);
      if (!latest || !prev) throw new Error("not enough prices");
      const changePct = round((latest.close / prev.close - 1) * 100, 2);
      // 이미 가져온 1개월 daily close 를 그대로 mini sparkline 으로 함께 내려준다 (실데이터, 최근 30포인트).
      const sparkline = prices
        .filter((p) => finite(p.close))
        .slice(-30)
        .map((p) => ({ date: p.date, value: round(p.close, item.digits) }));
      return { key: item.key, label: item.label, value: formatValue(latest.close, item.digits, "prefix" in item ? item.prefix : ""), changePct, up: changePct >= 0, source: "yahoo", updatedAt: latest.date, error: undefined, sparkline };
    } catch (e) {
      warnings.push({ code: `${item.key}_unavailable`, message: e instanceof Error ? e.message : String(e) });
      return { key: item.key, label: item.label, value: "조회 불가", changePct: null, up: false, source: "unavailable", updatedAt: null, error: "조회 불가" };
    }
  })));

  const priceMap: Record<string, QuoteHistoryPrice[]> = {};
  await Promise.all(WATCHLIST.map(async (ticker) => {
    try { priceMap[ticker] = await fetchPrices(ticker, yahooRange); }
    catch (e) { priceMap[ticker] = []; warnings.push({ code: `${ticker}_history_unavailable`, message: e instanceof Error ? e.message : String(e) }); }
  }));

  const rsiByTicker: Record<string, Array<{ date: string; value: number }>> = {};
  const ddByTicker: Record<string, Array<{ date: string; value: number }>> = {};
  const temperatures = WATCHLIST.flatMap((ticker) => {
    const prices = priceMap[ticker] ?? [];
    const latest = prices.at(-1); const prev = prices.at(-2);
    const rsiRows = calculateRsi14(prices); const ddRows = calculateRollingDrawdown(prices);
    rsiByTicker[ticker] = rsiRows; ddByTicker[ticker] = ddRows;
    if (!latest || !prev || rsiRows.length === 0 || ddRows.length === 0) return [];
    return [{ ticker, price: latest.close, changePct: round((latest.close / prev.close - 1) * 100, 2), drawdownPct: ddRows.at(-1)!.value, rsi: round(rsiRows.at(-1)!.value, 0), source: "yahoo" }];
  });

  let vix: SeriesPoint[] = [];
  try { vix = (await fetchPrices("^VIX", yahooRange)).map((p) => ({ date: p.date, VIX: p.close })); }
  catch (e) { warnings.push({ code: "vix_unavailable", message: e instanceof Error ? e.message : String(e) }); }

  const hasLive = Boolean(fearGreed || briefing.some((b) => b.source !== "unavailable") || temperatures.length || vix.length);
  const source = !hasLive ? "unavailable" : warnings.length > 0 ? "partial" : "live";
  return { source, updatedAt: hasLive ? nowIso() : null, fearGreed, briefing, temperatures, rsi: mergeSeries(rsiByTicker), drawdown: mergeSeries(ddByTicker), vix, warnings };
}
