#!/usr/bin/env node
// =============================================================
// 역산 성과 분석 - "일별 기준 MDD/위험지표" 검증 하니스.
//
// 목적(요구사항 1~8, 13, 14):
//   - 위험지표(MDD/Sharpe/Sortino/Calmar)가 차트용 "월별 축약" 데이터가 아니라
//     기간 내 "일별 거래일 전체" 시계열 기준으로 계산되는지 실제 코드로 증명한다.
//   - 월말 종가만 보면 놓치는 "월중 하락"을 일별 곡선이 정확히 잡아내는지 확인한다.
//   - 6개월/1년/2년 기간별 실제 사용 데이터 포인트 수를 출력한다.
//
// (실 환경은 외부 시세 API 가 차단되므로, 실제 production 코드
//  buildSnapshotBacktest / buildBacktestDailyCurves / computeBacktestRiskMetrics 에
//  결정적 합성 "일별" 시세를 입력해 계산식을 검증한다. 날짜 밀도/계산식이 검증 대상.)
// =============================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(out.outputText, filename);
};

const { buildSnapshotBacktest, buildBacktestDailyCurves } = require("../lib/snapshot-backtest.ts");
const { computeBacktestRiskMetrics } = require("../lib/backtest-risk-metrics.ts");

// ---- 합성 "일별"(평일) 시세 생성 ----
// close(i, date) 콜백으로 종가를 정한다. 주말은 건너뛴다.
function dailySeries(startISO, endISO, closeFn) {
  const out = [];
  const d = new Date(`${startISO}T00:00:00Z`);
  const last = new Date(`${endISO}T00:00:00Z`);
  let i = 0;
  while (d <= last) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, close: closeFn(i, iso) });
      i += 1;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const today = new Date();
const asOf = today.toISOString().slice(0, 10);
const start = new Date(today);
start.setUTCMonth(start.getUTCMonth() - 26);
const startISO = start.toISOString().slice(0, 10);

// 월중 급락 후 같은 달 안에서 회복하는 구간을 심는다.
// → 월말 종가만 보면 거의 평탄(작은 MDD), 일별로 보면 깊은 MDD 가 드러난다.
// 급락 월: asOf 기준 약 3개월 전(6개월 윈도우 안에 들어오도록).
const dipMonth = new Date(today);
dipMonth.setUTCMonth(dipMonth.getUTCMonth() - 3);
const dipMonthKey = dipMonth.toISOString().slice(0, 7);

function withMidMonthDip(base) {
  return (i, iso) => {
    let price = base(i);
    // 급락 월의 8~20일 사이에 V자 급락(-12% 저점) 후 월말까지 회복.
    if (iso.slice(0, 7) === dipMonthKey) {
      const day = Number(iso.slice(8, 10));
      if (day >= 8 && day <= 22) {
        const t = (day - 8) / 14; // 0..1
        const dip = -0.12 * Math.sin(t * Math.PI); // 0 → -12% → 0
        price = price * (1 + dip);
      }
    }
    return Number(price.toFixed(4));
  };
}

// 완만한 우상향(일 0.03%/거래일 ≈ 연 ~8%).
const growth = (rate) => (i) => 100 * Math.pow(1 + rate, i);

const QQQ = dailySeries(startISO, asOf, withMidMonthDip(growth(0.0006)));
const SPY = dailySeries(startISO, asOf, withMidMonthDip(growth(0.0004)));
const SCHD = dailySeries(startISO, asOf, growth(0.0002)); // 비교 티커(급락 없음)
const HOLD = dailySeries(startISO, asOf, withMidMonthDip(growth(0.0005))); // 보유 종목
const FX = dailySeries(startISO, asOf, () => 1350); // 환율 평탄

const entries = [
  { key: "HOLD", label: "보유 ETF", valueKRW: 100_000_000, ticker: "HOLD", proxyTicker: undefined, isUsd: true, isCash: false },
];
const baseInput = (months) => ({
  entries,
  priceHistories: { HOLD },
  benchmarkHistories: { spy: SPY, qqq: QQQ, custom: SCHD },
  fxHistory: FX,
  months,
  asOfDate: asOf,
  customTicker: "SCHD",
  customLabel: "SCHD 투자 시",
  customIsUsd: true,
});

const pct = (v) => (v == null ? "—" : `${v.toFixed(2)}%`);
const ratio = (v) => (v == null ? "—" : v.toFixed(2));

console.log("======================================================================");
console.log(" 역산 성과 분석 - 일별 MDD/위험지표 검증 (합성 일별 시세)");
console.log(` asOf=${asOf} · 급락월(월중 V자 -12%)=${dipMonthKey}`);
console.log("======================================================================\n");

const PERIODS = [
  { m: 24, label: "2년" },
  { m: 12, label: "1년" },
  { m: 6, label: "6개월" },
];

for (const p of PERIODS) {
  const input = baseInput(p.m);
  const monthly = buildSnapshotBacktest(input);
  const daily = buildBacktestDailyCurves(input);

  // 월별(차트) 축약 데이터로 계산한 MDD — 잘못된 옛 방식(연율화 12).
  const monthlyQqqMdd = computeBacktestRiskMetrics(monthly.points.map((pt) => pt.qqq), 12).mddPct;
  // 일별 곡선으로 계산한 MDD — 새 방식(연율화 252).
  const m = {
    portfolio: computeBacktestRiskMetrics(daily.portfolio),
    spy: computeBacktestRiskMetrics(daily.spy),
    qqq: computeBacktestRiskMetrics(daily.qqq),
    custom: computeBacktestRiskMetrics(daily.custom),
  };

  console.log(`### ${p.label} 역산`);
  console.log(
    `  데이터 포인트(일별): 포트 ${daily.counts.portfolio} · SPY ${daily.counts.spy} · QQQ ${daily.counts.qqq} · SCHD ${daily.counts.custom}` +
      `   | 차트(월별) 포인트: ${monthly.points.length}`,
  );
  console.log(`  QQQ MDD  | 월별축약(옛방식) ${pct(monthlyQqqMdd)}  →  일별(새방식) ${pct(m.qqq.mddPct)}`);
  console.log(
    `  지표(일별) 내포트 MDD ${pct(m.portfolio.mddPct)} Sharpe ${ratio(m.portfolio.sharpe)} Sortino ${ratio(m.portfolio.sortino)} Calmar ${ratio(m.portfolio.calmar)}`,
  );
  console.log(
    `             SPY MDD ${pct(m.spy.mddPct)} · QQQ MDD ${pct(m.qqq.mddPct)} · SCHD MDD ${pct(m.custom.mddPct)}\n`,
  );

  // [검증 1] 일별 데이터 밀도: 거래일 ≈ 21/월. 6개월≥110, 1년≥230, 2년≥470.
  const minPts = p.m === 6 ? 110 : p.m === 12 ? 230 : 470;
  assert.ok(daily.counts.qqq >= minPts, `${p.label}: 일별 QQQ 포인트 부족 ${daily.counts.qqq} < ${minPts}`);
  // [검증 2] 일별 MDD 가 월별 축약 MDD 보다 깊다(월중 하락을 잡아낸다).
  assert.ok(
    Math.abs(m.qqq.mddPct) > Math.abs(monthlyQqqMdd) + 3,
    `${p.label}: 일별 MDD(${pct(m.qqq.mddPct)})가 월별축약(${pct(monthlyQqqMdd)})보다 충분히 깊지 않음`,
  );
  // [검증 3] 6개월 윈도우의 일별 MDD 는 심어둔 -12% 급락을 반영해야 한다.
  if (p.m === 6) {
    assert.ok(m.qqq.mddPct <= -7, `6개월 QQQ 일별 MDD 가 -7% 보다 얕음: ${pct(m.qqq.mddPct)}`);
  }
  // [검증 4] 모든 비교군이 동일 기준으로 계산되어 MDD/지표가 산출된다.
  for (const key of ["portfolio", "spy", "qqq", "custom"]) {
    assert.ok(m[key].mddPct != null && m[key].mddPct <= 0, `${p.label}/${key}: MDD 음수/유효`);
  }
  // [검증 5] Calmar = CAGR/|MDD| → MDD 가 깊어지면 Calmar 도 함께 재계산된다(유효값).
  assert.ok(m.qqq.calmar != null, `${p.label}: QQQ Calmar 계산 불가`);
}

console.log("----------------------------------------------------------------------");
console.log("결론:");
console.log(" - 위험지표는 일별 거래일 전체 곡선 기준으로 계산된다(월별 축약 재사용 금지).");
console.log(" - 월중 급락이 일별 MDD 에 정확히 반영된다(월말 종가만 보면 놓친다).");
console.log(" - 6개월/1년/2년 모두 동일 계산식, 모든 비교군 동일 기준.");
console.log("\n모든 검증 통과 ✅");
