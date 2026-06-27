// =============================================================
// SCHD detail-chart line tabs (Compare / US10Y / Spread).
// Builds the extra line-metric tabs rendered alongside the
// existing "Price" candlestick view inside IndexDetailModal on
// the SCHD 매력도 page.
//
// Tabs (the legacy "Dividend" tab was removed — it duplicated the
// main page's SCHD Dividend Yield chart and added no new insight):
//   - "Compare"  SPY vs SCHD total return (after-tax dividends
//                reinvested), normalized to 100 at the start of the
//                selected range. Daily history via /api/market/long-series.
//   - "US10Y"    US 10Y Treasury yield (^TNX) as a daily line, fetched
//                over the FULL SCHD-dividend history window (period1/
//                period2 daily) instead of a capped 5y range token.
//   - "Spread"   = SCHD Dividend Yield (TTM) − US 10Y Treasury Yield,
//                reusing the same ^TNX fetch (cache hit) so it now spans
//                the full dividend history too.
//
// Data reuse / no duplicate calls: US10Y + Spread share one ^TNX
// long-series fetch (cached by symbol+start); Compare shares one
// SPY + one SCHD long-series fetch.
// =============================================================

import { type DetailLinePoint, type DetailLineSeries, type DetailLineTab } from "@/lib/market-index";
import { fetchLongSeries, type LongSeriesDividend, type LongSeriesPoint } from "@/lib/market-series";

// Yahoo symbol for the US 10-Year Treasury yield. ^TNX is quoted
// directly in percent (e.g. 4.49 == 4.49%), so no scaling is needed.
export const US10Y_SYMBOL = "^TNX";

// US withholding tax applied to US-ETF dividends for a Korean investor.
// Compare uses an AFTER-TAX (세후) dividend-reinvestment total return so the
// SPY vs SCHD comparison reflects what actually compounds in the account.
export const DIVIDEND_WITHHOLDING_TAX = 0.15;

// Earliest history requested for the Compare tab (SPY/SCHD). SCHD inception is
// 2011-10; SPY goes back further, so the intersected series starts ~2011-10.
const COMPARE_START_ISO = "2011-01-01";

// Tab colors (existing project tokens).
export const US10Y_LINE_COLOR = "#3b82f6"; // project blue (MA60 token)
export const SPREAD_LINE_COLOR = "#8b5cf6"; // project purple
export const COMPARE_SCHD_COLOR = "#f2994a"; // SCHD orange (same as dividend line)
export const COMPARE_SPY_COLOR = "#22c55e"; // SPY green

// Subtract N days from an ISO date (used to pad the ^TNX fetch start so the
// earliest dividend date in the Spread still finds a treasury value on/before).
function isoMinusDays(iso: string, days: number): string {
  const ms = new Date(`${iso}T00:00:00Z`).getTime();
  if (!Number.isFinite(ms)) return COMPARE_START_ISO;
  return new Date(ms - days * 86_400_000).toISOString().slice(0, 10);
}


// -------------------------------------------------------------
// US10Y
// -------------------------------------------------------------

// Fetch the US 10Y Treasury yield as a daily line series over the full
// requested window. Cached per (symbol, start) so US10Y + Spread reuse it.
export async function fetchUs10yRaw(start: string): Promise<DetailLinePoint[]> {
  const series = await fetchLongSeries(US10Y_SYMBOL, start);
  return series.points
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .map((p) => ({ date: p.date, value: p.close }));
}

// -------------------------------------------------------------
// Spread = SCHD Dividend Yield (TTM) − US 10Y Treasury Yield.
// -------------------------------------------------------------
// Both series are daily percentages but trading days may not align exactly,
// so the US10Y value is forward-filled (latest value on/before each dividend
// date). Result can be positive or negative.
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
    while (pointer < us10yAsc.length && us10yAsc[pointer].date <= point.date) {
      lastUs10y = us10yAsc[pointer].value;
      pointer += 1;
    }
    if (lastUs10y == null) continue; // no treasury data yet for the earliest dividend dates
    spread.push({ date: point.date, value: Number((point.value - lastUs10y).toFixed(4)) });
  }
  return spread;
}

// -------------------------------------------------------------
// Compare = SPY vs SCHD after-tax total return (dividends reinvested).
// -------------------------------------------------------------

// Build a dividend-reinvested total-return index from daily closes + dividend
// events. Dividends are taxed at `taxRate` (WHT) before reinvestment at the
// ex-date close. The raw index (un-normalized) is returned; the modal
// re-bases it to 100 at the start of the selected range.
export function buildTotalReturnIndex(
  points: LongSeriesPoint[],
  dividends: LongSeriesDividend[],
  taxRate: number,
): DetailLinePoint[] {
  if (!points.length) return [];
  const divByDate = new Map<string, number>();
  for (const d of dividends) {
    if (Number.isFinite(d.amount) && d.amount > 0) divByDate.set(d.date, (divByDate.get(d.date) ?? 0) + d.amount);
  }
  let shares = 1;
  const out: DetailLinePoint[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.close) || p.close <= 0) continue;
    const div = divByDate.get(p.date);
    if (div != null) {
      const net = div * (1 - taxRate); // after-tax dividend per share
      shares += (shares * net) / p.close; // reinvest at the ex-date close
    }
    out.push({ date: p.date, value: Number((shares * p.close).toFixed(6)) });
  }
  return out;
}

// Intersect two TR indices on their common trading dates so both lines share
// an identical X grid and therefore an identical 100 start point after the
// modal normalizes them.
function intersectByDate(a: DetailLinePoint[], b: DetailLinePoint[]): { a: DetailLinePoint[]; b: DetailLinePoint[] } {
  const bByDate = new Map(b.map((p) => [p.date, p.value]));
  const outA: DetailLinePoint[] = [];
  const outB: DetailLinePoint[] = [];
  for (const p of a) {
    const bv = bByDate.get(p.date);
    if (bv == null) continue;
    outA.push({ date: p.date, value: p.value });
    outB.push({ date: p.date, value: bv });
  }
  return { a: outA, b: outB };
}

// Resolve the SPY + SCHD after-tax total-return series for the Compare tab.
export async function fetchCompareSeries(): Promise<DetailLineSeries[]> {
  const [spy, schd] = await Promise.all([
    fetchLongSeries("SPY", COMPARE_START_ISO),
    fetchLongSeries("SCHD", COMPARE_START_ISO),
  ]);
  const spyTr = buildTotalReturnIndex(spy.points, spy.dividends, DIVIDEND_WITHHOLDING_TAX);
  const schdTr = buildTotalReturnIndex(schd.points, schd.dividends, DIVIDEND_WITHHOLDING_TAX);
  if (!spyTr.length || !schdTr.length) return [];
  const aligned = intersectByDate(spyTr, schdTr);
  return [
    { key: "spy", label: "SPY", color: COMPARE_SPY_COLOR, points: aligned.a },
    { key: "schd", label: "SCHD", color: COMPARE_SCHD_COLOR, points: aligned.b },
  ];
}

// Build the extra line tabs for the SCHD detail modal. `dividendSeries`
// is the SCHD Dividend Yield (TTM) history already computed on the page.
export function buildSchdDetailLineTabs(dividendSeries: DetailLinePoint[]): DetailLineTab[] {
  // Align US10Y / Spread to the dividend history: fetch ^TNX from slightly
  // before the first dividend date (so forward-fill covers it) and clip the
  // US10Y display to the dividend start so both tabs begin together.
  const dividendStart = dividendSeries.length ? dividendSeries[0].date : COMPARE_START_ISO;
  const us10yFetchStart = isoMinusDays(dividendStart, 60);
  const resolveUs10yFull = () => fetchUs10yRaw(us10yFetchStart);

  return [
    {
      key: "compare",
      label: "Compare",
      color: COMPARE_SCHD_COLOR,
      unit: "",
      digits: 1,
      normalizeToStart: true,
      resolveMulti: fetchCompareSeries,
    },
    {
      key: "us10y",
      label: "US10Y",
      color: US10Y_LINE_COLOR,
      unit: "%",
      digits: 2,
      resolve: async () => (await resolveUs10yFull()).filter((p) => p.date >= dividendStart),
    },
    {
      key: "spread",
      label: "Spread",
      color: SPREAD_LINE_COLOR,
      unit: "%",
      digits: 2,
      zeroBaseline: true,
      resolve: async () => computeSpreadSeries(dividendSeries, await resolveUs10yFull()),
    },
  ];
}
