// =============================================================
// SCHD detail-chart line tabs (Dividend / US10Y / Spread).
// Builds the extra line-metric tabs rendered alongside the
// existing "Price" candlestick view inside IndexDetailModal on
// the SCHD 매력도 page.
//
// Data reuse / no duplicate calls:
//   - "Dividend"  reuses the SCHD TTM yield series already computed
//                 on the page (same source as the main chart).
//   - "US10Y"     fetches ^TNX once via fetchIndexQuote (in-memory
//                 cached per symbol+range), shared with "Spread".
//   - "Spread"    = SCHD Dividend Yield (TTM) − US 10Y Treasury Yield,
//                 reusing the same ^TNX fetch (cache hit).
//
// Extensible: append another entry (Real Yield / MOVE / VIX …) by
// adding a DetailLineTab with its own resolve(); the modal/chart
// need no changes.
// =============================================================

import { fetchIndexQuote, type DetailLinePoint, type DetailLineTab } from "@/lib/market-index";

// Yahoo symbol for the US 10-Year Treasury yield. ^TNX is quoted
// directly in percent (e.g. 4.49 == 4.49%), so no scaling is needed.
export const US10Y_SYMBOL = "^TNX";

// Widest range that still yields *daily* candles from Yahoo (range=max
// downgrades to monthly), matching the Price tab's own daily cap.
const US10Y_DAILY_RANGE = "5y";

// Tab colors. Prefer existing project color tokens:
//   - Dividend: identical to the main SCHD Dividend Yield TTM line.
//   - US10Y:    project blue (DOWN_COLOR / MA60 token #3b82f6).
//   - Spread:   project purple (SERIES_COLORS purple #8b5cf6).
export const SCHD_DIVIDEND_LINE_COLOR = "#f2994a";
export const US10Y_LINE_COLOR = "#3b82f6";
export const SPREAD_LINE_COLOR = "#8b5cf6";

// Fetch the US 10Y Treasury yield as a daily line series. Reuses
// fetchIndexQuote so repeated calls (US10Y + Spread) hit the cache.
export async function fetchUs10ySeries(): Promise<DetailLinePoint[]> {
  const quote = await fetchIndexQuote(US10Y_SYMBOL, US10Y_DAILY_RANGE);
  return quote.candles
    .filter((candle) => typeof candle.time === "string" && Number.isFinite(candle.close) && candle.close > 0)
    .map((candle) => ({ date: candle.time as string, value: candle.close }));
}

// Dividend Spread = SCHD Dividend Yield (TTM) − US 10Y Treasury Yield.
// Both series are daily percentages but trading days may not align
// exactly, so the US10Y value is forward-filled (latest value on or
// before each dividend date). Result can be positive or negative.
export function computeSpreadSeries(
  dividend: DetailLinePoint[],
  us10y: DetailLinePoint[],
): DetailLinePoint[] {
  if (!dividend.length || !us10y.length) return [];

  const dividendAsc = [...dividend].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const us10yAsc = [...us10y].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const spread: DetailLinePoint[] = [];
  let pointer = 0;
  let lastUs10y: number | null = null;
  for (const point of dividendAsc) {
    // Advance the US10Y pointer to the latest entry on/before this date.
    while (pointer < us10yAsc.length && us10yAsc[pointer].date <= point.date) {
      lastUs10y = us10yAsc[pointer].value;
      pointer += 1;
    }
    if (lastUs10y == null) continue; // no treasury data yet for the earliest dividend dates
    spread.push({ date: point.date, value: Number((point.value - lastUs10y).toFixed(4)) });
  }
  return spread;
}

// Build the extra line tabs for the SCHD detail modal. `dividendSeries`
// is the SCHD Dividend Yield (TTM) history already computed on the page.
export function buildSchdDetailLineTabs(dividendSeries: DetailLinePoint[]): DetailLineTab[] {
  return [
    {
      key: "dividend",
      label: "Dividend",
      color: SCHD_DIVIDEND_LINE_COLOR,
      unit: "%",
      digits: 2,
      resolve: async () => dividendSeries,
    },
    {
      key: "us10y",
      label: "US10Y",
      color: US10Y_LINE_COLOR,
      unit: "%",
      digits: 2,
      resolve: fetchUs10ySeries,
    },
    {
      key: "spread",
      label: "Spread",
      color: SPREAD_LINE_COLOR,
      unit: "%",
      digits: 2,
      zeroBaseline: true,
      resolve: async () => computeSpreadSeries(dividendSeries, await fetchUs10ySeries()),
    },
  ];
}
