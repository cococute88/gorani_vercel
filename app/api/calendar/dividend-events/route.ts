import { NextResponse } from "next/server";
import { mergeDeclaredAndProjectedEvents, yahooRowsFromQuoteResponse, type DeclaredDividendRow, type DividendLiveResponse, type ProviderStatus } from "@/lib/calendar-dividend-live";
import { normalizeTicker, getQuoteDividends } from "@/lib/server/quote-fetchers";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

export const dynamic = "force-dynamic";

type PolygonDividend = { ex_dividend_date?: string; cash_amount?: number; pay_date?: string };
type FinnhubDividend = { date?: string; exDate?: string; amount?: number; dividend?: number; payDate?: string; paymentDate?: string };
const TIMEOUT_MS = 9000;
// Streamlit `_safe_request` parity: Polygon's free tier rate-limit (429) is
// retried with backoff instead of immediately abandoning the ticker. Abandoning
// it on a transient 429 is what drops the refresh back to a stale Yahoo-estimated
// future. Waits are kept short so the serverless function stays within timeout.
const POLYGON_MAX_ATTEMPTS = 3;
const POLYGON_RETRY_WAIT_MS = 2000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" }, cache: "no-store" });
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally { clearTimeout(timeout); }
}

async function fetchPolygon(ticker: string, status: ProviderStatus, warnings: string[]): Promise<DeclaredDividendRow[]> {
  const key = process.env.POLYGON_API_KEY;
  if (!key) { status.polygon = "missing_key"; return []; }
  const url = new URL("https://api.polygon.io/v3/reference/dividends");
  url.searchParams.set("ticker", ticker); url.searchParams.set("limit", "50"); url.searchParams.set("sort", "ex_dividend_date"); url.searchParams.set("order", "desc"); url.searchParams.set("apiKey", key);
  for (let attempt = 1; attempt <= POLYGON_MAX_ATTEMPTS; attempt += 1) {
    try {
      const payload = await fetchJson(url.toString()) as { results?: PolygonDividend[] };
      status.polygon = "ok";
      return (payload.results ?? []).flatMap((item) => {
        const exDate = item.ex_dividend_date?.slice(0, 10); const amount = Number(item.cash_amount);
        return exDate && Number.isFinite(amount) && amount > 0 ? [{ exDate, amount, payDate: item.pay_date?.slice(0, 10) }] : [];
      });
    } catch (error) {
      const rateLimited = error instanceof Error && error.message === "RATE_LIMITED";
      if (rateLimited && attempt < POLYGON_MAX_ATTEMPTS) {
        await delay(POLYGON_RETRY_WAIT_MS * attempt);
        continue;
      }
      status.polygon = rateLimited ? "rate_limited" : "failed";
      warnings.push(`Polygon dividend lookup failed for ${ticker}${rateLimited ? " (rate limited after retries)" : ""}.`);
      return [];
    }
  }
  return [];
}

// Full per-ticker event dump for the calendar refresh (server logs / Vercel
// function logs). Prints every generated Calendar Event with the fields the team
// compares against Streamlit: ticker · eventType · source · estimated · exDate ·
// buyDate · paymentDate. This is the "최신화 직후 전체 이벤트 출력" diagnostic.
function logGeneratedCalendarEvents(ticker: string, source: string, providerStatus: ProviderStatus, events: CalendarEvent[]) {
  const rows = events.map((event) => ({
    ticker: event.ticker,
    eventType: event.type,
    source: event.sourceKind,
    estimated: event.status === "estimated",
    exDate: event.exDivDate || "-",
    buyDate: event.type === "buy_by" ? event.date : event.buyDeadline || "-",
    paymentDate: event.paymentDate || "-",
  }));
  console.info(
    `[dividend-events] ${ticker} · source=${source} · polygon=${providerStatus.polygon ?? "-"} · ${events.length} events ` +
      JSON.stringify(rows),
  );
}
async function fetchFinnhub(ticker: string, status: ProviderStatus, warnings: string[]): Promise<DeclaredDividendRow[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) { status.finnhub = "missing_key"; return []; }
  try {
    const to = new Date(); to.setUTCFullYear(to.getUTCFullYear() + 1); const from = new Date(); from.setUTCFullYear(from.getUTCFullYear() - 5);
    const url = new URL("https://finnhub.io/api/v1/stock/dividend");
    url.searchParams.set("symbol", ticker); url.searchParams.set("from", from.toISOString().slice(0, 10)); url.searchParams.set("to", to.toISOString().slice(0, 10)); url.searchParams.set("token", key);
    const payload = await fetchJson(url.toString()) as FinnhubDividend[];
    status.finnhub = "ok";
    return (Array.isArray(payload) ? payload : []).flatMap((item) => {
      const exDate = (item.exDate ?? item.date)?.slice(0, 10); const amount = Number(item.amount ?? item.dividend);
      return exDate && Number.isFinite(amount) && amount > 0 ? [{ exDate, amount, payDate: (item.payDate ?? item.paymentDate)?.slice(0, 10) }] : [];
    });
  } catch {
    status.finnhub = "failed"; warnings.push(`Finnhub dividend lookup failed for ${ticker}.`); return [];
  }
}

export async function GET(request: Request) {
  const ticker = normalizeTicker(new URL(request.url).searchParams.get("ticker") ?? "");
  const updatedAt = new Date().toISOString();
  const providerStatus: ProviderStatus = {}; const warnings: string[] = [];
  if (!ticker) return NextResponse.json({ ticker: "", source: "unavailable", events: [], failedReason: "ticker is required", updatedAt, providerStatus, warnings } satisfies DividendLiveResponse, { status: 400 });
  const polygonRows = await fetchPolygon(ticker, providerStatus, warnings);
  const polygonBlockedFallback = providerStatus.polygon === "rate_limited" || providerStatus.polygon === "failed";
  const finnhubRows = polygonRows.length > 0 || polygonBlockedFallback ? [] : await fetchFinnhub(ticker, providerStatus, warnings);
  let yahooRows: ReturnType<typeof yahooRowsFromQuoteResponse> = [];
  try {
    const yahoo = await getQuoteDividends({ ticker, range: "5y" });
    providerStatus.yahoo = yahoo.source === "yahoo" ? "ok" : "sample_fallback";
    warnings.push(...yahoo.warnings.filter((warning) => !warning.includes("deterministic demo")));
    if (yahoo.source === "yahoo") yahooRows = yahooRowsFromQuoteResponse(yahoo);
  } catch { providerStatus.yahoo = "failed"; warnings.push(`Yahoo dividend lookup failed for ${ticker}.`); }
  const declared = polygonRows.length > 0 ? polygonRows : finnhubRows.length > 0 ? finnhubRows : providerStatus.polygon === "missing_key" ? yahooRows.map((row) => ({ exDate: row.date, amount: row.amount })) : [];
  const historyForProjection = yahooRows.length > 0 ? yahooRows : declared.map((row) => ({ date: row.exDate, amount: row.amount }));
  const events = polygonBlockedFallback ? [] : declared.length > 0 || historyForProjection.length > 0 ? mergeDeclaredAndProjectedEvents(ticker, declared, historyForProjection) : [];
  const source = events.length === 0 ? "unavailable" : providerStatus.polygon === "ok" && polygonRows.length > 0 ? "live" : "partial";
  logGeneratedCalendarEvents(ticker, source, providerStatus, events);
  return NextResponse.json({ ticker, source, events, failedReason: events.length === 0 ? (polygonBlockedFallback ? "Polygon dividend lookup failed; existing confirmed cache should be kept." : "No live dividend events were available.") : undefined, updatedAt, providerStatus, warnings, rateLimitDelayMs: providerStatus.polygon && providerStatus.polygon !== "missing_key" ? 12500 : undefined } satisfies DividendLiveResponse);
}
