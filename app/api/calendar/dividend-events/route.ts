import { NextResponse } from "next/server";
import { getQuoteDividends } from "@/lib/server/quote-fetchers";
import { normalizeCalendarTicker } from "@/lib/calendar-event-identity";
import { normalizeDividendEvents, projectFutureDividends, type DividendHistoryRow, type DividendLiveApiResponse, type DividendLiveProviderStatus } from "@/lib/calendar-dividend-live";

export const dynamic = "force-dynamic";
const TIMEOUT_MS = 10_000;

type Json = Record<string, unknown>;

async function fetchJson(url: string): Promise<Json> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as Json;
  } finally {
    clearTimeout(timeout);
  }
}

function polygonRows(payload: Json): DividendHistoryRow[] {
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.flatMap((row) => {
    const item = row as Json;
    const exDate = typeof item.ex_dividend_date === "string" ? item.ex_dividend_date : "";
    const amount = Number(item.cash_amount);
    return exDate && amount > 0 ? [{ exDate, amount, paymentDate: typeof item.pay_date === "string" ? item.pay_date : null, declaredDate: typeof item.declaration_date === "string" ? item.declaration_date : null, source: "polygon" }] : [];
  });
}

function finnhubRows(payload: unknown): DividendHistoryRow[] {
  const results = Array.isArray(payload) ? payload : [];
  return results.flatMap((row) => {
    const item = row as Json;
    const exDate = typeof item.date === "string" ? item.date : typeof item.exDate === "string" ? item.exDate : "";
    const amount = Number(item.amount);
    return exDate && amount > 0 ? [{ exDate, amount, paymentDate: typeof item.payDate === "string" ? item.payDate : null, declaredDate: typeof item.declarationDate === "string" ? item.declarationDate : null, source: "finnhub" }] : [];
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ticker = normalizeCalendarTicker(params.get("ticker") ?? "");
  const updatedAt = new Date().toISOString();
  const providerStatus: DividendLiveProviderStatus = {};
  const warnings: string[] = [];
  if (!ticker) return NextResponse.json({ ticker: "", source: "unavailable", events: [], failedReason: "Ticker is required.", updatedAt, providerStatus, warnings } satisfies DividendLiveApiResponse, { status: 400 });

  const polygonKey = process.env.POLYGON_API_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  let rows: DividendHistoryRow[] = [];

  if (polygonKey) {
    try {
      const url = `https://api.polygon.io/v3/reference/dividends?ticker=${encodeURIComponent(ticker)}&limit=50&sort=ex_dividend_date&order=desc&apiKey=${encodeURIComponent(polygonKey)}`;
      rows = polygonRows(await fetchJson(url));
      providerStatus.polygon = "ok";
    } catch (error) {
      providerStatus.polygon = error instanceof Error && error.message === "RATE_LIMITED" ? "rate_limited" : "failed";
      warnings.push("Polygon dividend lookup failed; fallback providers were used.");
    }
  } else providerStatus.polygon = "missing_key";

  if (rows.length === 0 && finnhubKey) {
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 1_830 * 86_400_000).toISOString().slice(0, 10);
      rows = finnhubRows(await fetchJson(`https://finnhub.io/api/v1/stock/dividend?symbol=${encodeURIComponent(ticker)}&from=${start}&to=${end}&token=${encodeURIComponent(finnhubKey)}`));
      providerStatus.finnhub = "ok";
    } catch {
      providerStatus.finnhub = "failed";
      warnings.push("Finnhub dividend lookup failed; Yahoo fallback was used.");
    }
  } else if (!finnhubKey) providerStatus.finnhub = "missing_key";
  else providerStatus.finnhub = "skipped";

  if (rows.length === 0) {
    try {
      const yahoo = await getQuoteDividends({ ticker, range: "5y" });
      if (yahoo.source === "sample") {
        rows = [];
        providerStatus.yahoo = "failed";
        warnings.push("Yahoo dividend lookup did not return live rows; sample fallback was ignored for live calendar refresh.");
      } else {
        rows = yahoo.dividends.map((d) => ({ exDate: d.date, amount: d.amount, source: yahoo.source }));
        providerStatus.yahoo = "ok";
      }
      warnings.push(...yahoo.warnings);
    } catch {
      providerStatus.yahoo = "failed";
      warnings.push("Yahoo dividend lookup failed.");
    }
  } else providerStatus.yahoo = "skipped";

  const declaredEvents = normalizeDividendEvents(ticker, rows);
  const projectedEvents = projectFutureDividends(ticker, rows);
  const events = [...declaredEvents, ...projectedEvents].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  const anyProviderOk = Object.values(providerStatus).includes("ok");
  return NextResponse.json({ ticker, source: events.length ? (anyProviderOk ? "live" : "partial") : "unavailable", events, failedReason: events.length ? undefined : "No dividend events were available from configured providers.", updatedAt, providerStatus, warnings, rateLimitDelayMs: providerStatus.polygon === "ok" || providerStatus.polygon === "rate_limited" ? 12_500 : 1_500 } satisfies DividendLiveApiResponse);
}
