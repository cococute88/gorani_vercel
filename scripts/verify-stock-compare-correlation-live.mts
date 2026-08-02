import assert from "node:assert/strict";
import { computeDailyReturnCorrelation } from "../lib/stock-compare/correlation";
import { COMPARE_PERIODS } from "../lib/stock-compare/constants";
import { toTrLevels } from "../lib/stock-compare/total-return";
import type { LongSeriesPoint } from "../lib/market-series";

type YahooPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
    error?: { description?: string } | null;
  };
};

const SYMBOLS = ["SPY", "QQQ", "QLD", "JEPI", "JEPQ", "069500.KS", "229200.KS", "IBIT"] as const;

async function fetchDaily(symbol: string): Promise<LongSeriesPoint[]> {
  const period1 = Math.floor(new Date("2015-01-01T00:00:00.000Z").getTime() / 1_000);
  const period2 = Math.floor(Date.now() / 1_000);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "div");
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 quote-api" },
  });
  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`);
  const payload = await response.json() as YahooPayload;
  if (payload.chart?.error) throw new Error(`${symbol}: ${payload.chart.error.description ?? "Yahoo chart error"}`);
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error(`${symbol}: Yahoo chart result 없음`);
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  return timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    const adjClose = adjusted[index];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) return [];
    return [{
      date: new Date(timestamp * 1_000).toISOString().slice(0, 10),
      close,
      adjClose: typeof adjClose === "number" && Number.isFinite(adjClose) && adjClose > 0 ? adjClose : null,
    }];
  });
}

const data = new Map(await Promise.all(SYMBOLS.map(async (symbol) => [symbol, await fetchDaily(symbol)] as const)));
for (const symbol of SYMBOLS) {
  assert.ok((data.get(symbol)?.length ?? 0) > 20, `${symbol}: 유효 일별 데이터 20개 초과`);
}

function correlation(a: string, b: string, mode: "TR" | "PR", days = Infinity) {
  const useTotalReturn = mode === "TR";
  return computeDailyReturnCorrelation(
    toTrLevels(a, data.get(a) ?? [], useTotalReturn),
    toTrLevels(b, data.get(b) ?? [], useTotalReturn),
    days,
  );
}

const pairRows = [
  ["SPY", "QQQ"],
  ["QLD", "JEPI"],
  ["QLD", "JEPQ"],
  ["SPY", "SPY"],
  ["069500.KS", "229200.KS"],
  ["SPY", "069500.KS"],
  ["IBIT", "SPY"],
] as const;

const results = pairRows.flatMap(([a, b]) => (["TR", "PR"] as const).map((mode) => {
  const result = correlation(a, b, mode);
  assert.equal(result.status, "ok", `${a}/${b} ${mode}: 계산 가능`);
  assert.ok(result.correlation != null && result.correlation >= -1 && result.correlation <= 1, `${a}/${b} ${mode}: 범위`);
  const swapped = correlation(b, a, mode);
  assert.ok(
    swapped.correlation != null && Math.abs(swapped.correlation - result.correlation) < 1e-12,
    `${a}/${b} ${mode}: A/B 대칭`,
  );
  return { pair: `${a} vs ${b}`, mode, correlation: result.correlation.toFixed(3), observations: result.observations };
}));

assert.equal(correlation("SPY", "SPY", "TR").correlation?.toFixed(3), "1.000", "동일 종목은 1.000");
assert.notEqual(
  correlation("SPY", "QQQ", "TR").correlation,
  correlation("SPY", "QQQ", "PR").correlation,
  "실제 배당 이벤트가 있는 종목의 TR/PR 계산 데이터가 달라야 함",
);

const periodRows = COMPARE_PERIODS.map(({ label, days }) => {
  const result = correlation("SPY", "QQQ", "TR", days);
  assert.equal(result.status, "ok", `SPY/QQQ ${label}: 계산 가능`);
  return { period: label, correlation: result.correlation!.toFixed(3), observations: result.observations };
});
for (let index = 1; index < periodRows.length - 1; index += 1) {
  assert.ok(periodRows[index].observations > periodRows[index - 1].observations, "기간이 길수록 관측값 증가");
}

console.log("Live stock-compare correlation verification passed.");
console.table(results);
console.log("SPY vs QQQ TR by selected period:");
console.table(periodRows);
