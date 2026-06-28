// 종목 성과 비교 계산 검증(네트워크 + 순수 계산식 invariant).
// 실행: npx --yes tsx scripts/check-stock-compare.mts
import assert from "node:assert/strict";
import { analyzeOverlap } from "../lib/stock-compare/holdings";
import { toTrLevels, buildCompareSeries, type TrLevels } from "../lib/stock-compare/total-return";
import { computeSeriesMetrics, computeRollingPoints } from "../lib/stock-compare/metrics";
import { computeContribution } from "../lib/stock-compare/contribution";

type YPoint = { date: string; close: number; adjClose: number | null };

async function fetchDaily(symbol: string, startIso: string): Promise<YPoint[]> {
  const period1 = Math.floor(new Date(`${startIso}T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=div`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 quote-api", accept: "application/json" } });
  if (!res.ok) throw new Error(`${symbol} HTTP ${res.status}`);
  const json: any = await res.json();
  const r = json.chart.result[0];
  const ts: number[] = r.timestamp ?? [];
  const close: (number | null)[] = r.indicators.quote[0].close ?? [];
  const adj: (number | null)[] = r.indicators.adjclose?.[0]?.adjclose ?? [];
  const out: YPoint[] = [];
  ts.forEach((t, i) => {
    const c = close[i];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), close: c, adjClose: typeof adj[i] === "number" ? adj[i] : null });
    }
  });
  return out;
}

async function main() {
  // 1) 데이터 백본: SPY/QQQ + 공통 종목 일부.
  const overlap = analyzeOverlap("SPY", "QQQ");
  assert.ok(overlap.hasHoldings, "SPY/QQQ holdings fixture present");
  assert.ok(overlap.commonCount > 0, "SPY/QQQ have common holdings");
  console.log(`공통 종목 ${overlap.commonCount}개:`, overlap.commonTickers.join(", "));
  console.log(`비중 중복도(SPY/QQQ): ${overlap.weightOverlapPctA}% / ${overlap.weightOverlapPctB}%, mutual ${overlap.mutualWeightPct}%`);

  const start = "2018-01-01";
  const symbols = ["SPY", "QQQ", ...overlap.commonTickers];
  const data = new Map<string, YPoint[]>();
  for (const s of symbols) {
    const pts = await fetchDaily(s, start);
    data.set(s, pts);
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.ok((data.get("SPY")?.length ?? 0) > 200, "SPY daily history fetched");
  assert.ok((data.get("QQQ")?.length ?? 0) > 200, "QQQ daily history fetched");
  console.log(`SPY ${data.get("SPY")!.length}일, QQQ ${data.get("QQQ")!.length}일 수신`);

  // 2) 시리즈 구성(TR, 비중 고려, 중복 제거).
  const aLevels = toTrLevels("SPY", data.get("SPY")!, true);
  const bLevels = toTrLevels("QQQ", data.get("QQQ")!, true);
  const commonLevels = new Map<string, TrLevels>();
  for (const t of overlap.commonTickers) {
    const pts = data.get(t);
    if (pts && pts.length) commonLevels.set(t, toTrLevels(t, pts, true));
  }

  const { series, exMeta } = buildCompareSeries({
    tickerA: "SPY",
    tickerB: "QQQ",
    aLevels,
    bLevels,
    overlap,
    commonLevels,
    periodDays: 365 * 5,
    options: { removeOverlap: true, weighted: true },
  });

  const keys = series.map((s) => s.key);
  assert.deepEqual(keys, ["a", "b", "aEx", "bEx"], "4개 시리즈 생성");
  assert.ok(exMeta.aAvailable && exMeta.bAvailable, "중복 제거 시리즈 가용");
  console.log("wFund SPY/QQQ:", exMeta.aWFund.toFixed(3), "/", exMeta.bWFund.toFixed(3));

  // 3) 지표.
  const metrics: Record<string, ReturnType<typeof computeSeriesMetrics>> = {};
  for (const s of series) metrics[s.key] = computeSeriesMetrics(s);
  for (const s of series) {
    const m = metrics[s.key];
    console.log(`${s.label}: TR ${m.trPct}% CAGR ${m.cagrPct}% MDD ${m.mddPct}% Sharpe ${m.sharpe}`);
    assert.ok(m.trPct != null && Number.isFinite(m.trPct), `${s.key} TR finite`);
    assert.ok(m.mddPct != null && m.mddPct <= 0, `${s.key} MDD <= 0`);
  }

  // 4) 기여도 가산성: commonContrib + uniqueContrib == trPct (오차 < 0.1%p).
  const cA = computeContribution({ trPct: metrics.a.trPct, trExPct: metrics.aEx?.trPct ?? null, wFund: exMeta.aWFund, available: exMeta.aAvailable });
  assert.ok(cA.available, "SPY 기여도 가용");
  const sum = (cA.commonContribPct ?? 0) + (cA.uniqueContribPct ?? 0);
  console.log(`SPY 기여도: 공통 ${cA.commonContribPct}%p + 비공통 ${cA.uniqueContribPct}%p = ${sum.toFixed(2)} (TR ${cA.trPct})`);
  assert.ok(Math.abs(sum - (cA.trPct ?? 0)) < 0.1, "기여도 합 == TR (선형 분해 가산성)");

  // 5) Rolling 1Y TR: 월말 포인트, 4개 시리즈 값 존재.
  const rolling = computeRollingPoints(series);
  assert.ok(rolling.length > 12, "Rolling 포인트 12개 이상");
  const withAll = rolling.filter((r) => r.a != null && r.b != null).length;
  console.log(`Rolling 월말 포인트 ${rolling.length}개 (a&b 동시 ${withAll}개)`);
  assert.ok(withAll > 12, "Rolling a/b 동시 값 충분");

  // 6) 동일 티커 안전성.
  const sameOverlap = analyzeOverlap("AAPL", "AAPL"); // holdings 없음 → 빈 overlap
  assert.equal(sameOverlap.hasHoldings, false, "개별 주식은 holdings 없음 → 빈 overlap");

  console.log("\n✅ 종목 성과 비교 계산 검증 통과");
}

main().catch((e) => {
  console.error("❌ 검증 실패:", e);
  process.exit(1);
});
