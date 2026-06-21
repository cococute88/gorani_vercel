#!/usr/bin/env node
// =============================================================
// 역산 성과 분석 - 계좌 필터/기간별 검증 리포트 + 차트 아티팩트 생성.
//
// 실제 lib/snapshot-backtest.ts 와 matchesAccountTab 을 그대로 사용해
//   - 전체 / 국내 / 해외 / ISA / 연금 계좌별
//   - 2년 / 1년 / 6개월 기간별
// 현재가치 · 역산원금 · 수익률을 출력하고,
// "그래프 마지막 값 == 카드 현재가치" 일치를 단언한다.
//
// (실 환경은 외부 시세 API 가 차단되어 라이브 스크린샷을 만들 수 없으므로,
//  동일 계산 로직에 합성 시세를 입력한 결정적 검증으로 대체한다.)
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
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(out.outputText, filename);
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { buildSnapshotBacktest } = require("../lib/snapshot-backtest.ts");
const { matchesAccountTab, MIN_HOLDING_VALUE_KRW, resolveHoldingDisplayName } = require("../lib/account-holding-weights.ts");
const { normalizeHoldingTickerInfo } = require("../lib/holding-ticker-normalizer.ts");
const { getQuoteTickerForHolding } = require("../lib/ticker-mapper.ts");

// ---- 컴포넌트의 buildEntries 와 동일 로직(스냅샷 보유종목 → 백테스트 엔트리) ----
function buildEntries(holdings) {
  const map = new Map();
  for (const holding of holdings ?? []) {
    const valueKRW =
      typeof holding.valueKRW === "number" && Number.isFinite(holding.valueKRW) && holding.valueKRW > 0
        ? holding.valueKRW
        : 0;
    if (valueKRW <= 0) continue;
    const info = normalizeHoldingTickerInfo(holding);
    const quoteTicker = getQuoteTickerForHolding(holding);
    const isCash = !quoteTicker;
    const tickerUpper = (quoteTicker ?? "").toUpperCase();
    const isUsd =
      !isCash && !/^\d{6}(\.(KS|KQ))?$/.test(tickerUpper) && (holding.currency ?? "").toUpperCase() !== "KRW";
    const proxy =
      info.exposureProxy && info.exposureProxy.toUpperCase() !== tickerUpper ? info.exposureProxy.toUpperCase() : undefined;
    const label = resolveHoldingDisplayName(holding);
    const key = quoteTicker ?? `name:${(holding.cleanName ?? holding.productName ?? label).toUpperCase()}`;
    const existing = map.get(key);
    if (existing) existing.valueKRW += valueKRW;
    else map.set(key, { key, label, valueKRW, ticker: quoteTicker, proxyTicker: proxy, isUsd, isCash });
  }
  return Array.from(map.values()).filter((e) => e.valueKRW >= MIN_HOLDING_VALUE_KRW);
}

// ---- 합성 시세 생성 (월별 등비 성장) ----
function series(startISO, count, startClose, monthlyGrowth) {
  const out = [];
  const d = new Date(`${startISO}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    const date = new Date(d);
    date.setUTCMonth(date.getUTCMonth() + i);
    out.push({ date: date.toISOString().slice(0, 10), close: startClose * (1 + monthlyGrowth) ** i });
  }
  return out;
}
const today = new Date();
const start = new Date(today);
start.setUTCMonth(start.getUTCMonth() - 25);
const startISO = start.toISOString().slice(0, 10);
const asOf = today.toISOString().slice(0, 10);
const N = 26;

// 종목별 합성 시세(월 성장률). 해외 고성장, 국내/배당 중간, 채권/현금 평탄.
const PX = {
  TQQQ: series(startISO, N, 30, 0.045),       // 해외 레버리지 (고성장)
  SCHD: series(startISO, N, 70, 0.012),       // 해외 배당
  SGOV: series(startISO, N, 100, 0.0015),     // 해외 단기채(현금성에 가까움, 그러나 가격 사용)
  "069500.KS": series(startISO, N, 28000, 0.009),  // 국내 KODEX200
  "360750.KS": series(startISO, N, 15000, 0.018),  // ISA: TIGER 미국S&P500(원화)
  "379800.KS": series(startISO, N, 13000, 0.016),  // 연금: KODEX 미국S&P500(원화)
};
const SPY = series(startISO, N, 400, 0.013);
const QQQ = series(startISO, N, 300, 0.019);
const CUSTOM = series(startISO, N, 70, 0.012); // SCHD
const FX = series(startISO, N, 1350, 0.0);     // 환율 평탄(검증 단순화)

// ---- 현실적인 다계좌 스냅샷(현재 평가액 ≈ 6억) ----
function h(o) {
  return { id: o.id, broker: o.broker ?? "", assetType: o.assetType ?? "ETF", productName: o.productName, principalKRW: 0, valueKRW: o.valueKRW, ...o };
}
const holdings = [
  // 해외 계좌 (영문 티커)
  h({ id: "1", productName: "TQQQ", ticker: "TQQQ", currency: "USD", accountName: "해외주식", valueKRW: 210_000_000 }),
  h({ id: "2", productName: "SCHD", ticker: "SCHD", currency: "USD", accountName: "해외주식", valueKRW: 100_000_000 }),
  h({ id: "3", productName: "SGOV", ticker: "SGOV", currency: "USD", accountName: "해외주식", valueKRW: 50_000_000 }),
  // 국내 계좌 (KRX 숫자형)
  h({ id: "4", productName: "KODEX 200", ticker: "069500.KS", currency: "KRW", accountName: "국내주식", valueKRW: 80_000_000 }),
  // ISA 계좌
  h({ id: "5", productName: "TIGER 미국S&P500", ticker: "360750.KS", currency: "KRW", accountName: "ISA", valueKRW: 70_000_000 }),
  // 연금 계좌
  h({ id: "6", productName: "KODEX 미국S&P500", ticker: "379800.KS", currency: "KRW", accountName: "연금저축펀드", valueKRW: 60_000_000 }),
  // 현금성(MMF) — 해외도 국내도 아님(현금 평탄)
  h({ id: "7", productName: "KODEX 머니마켓액티브", accountName: "수시입출", valueKRW: 30_000_000 }),
];

function run(tab, months) {
  const filtered = tab === "전체" ? holdings : holdings.filter((x) => matchesAccountTab(x, tab));
  const entries = buildEntries(filtered);
  const priceHistories = {};
  for (const e of entries) {
    if (e.ticker && PX[e.ticker.toUpperCase()]) priceHistories[e.ticker.toUpperCase()] = PX[e.ticker.toUpperCase()];
  }
  return buildSnapshotBacktest({
    entries,
    priceHistories,
    benchmarkHistories: { spy: SPY, qqq: QQQ, custom: CUSTOM },
    fxHistory: FX,
    months,
    asOfDate: asOf,
    customTicker: "SCHD",
    customLabel: "SCHD 투자 시",
    customIsUsd: true,
  });
}

const won = (v) => (v == null ? "—" : `₩${Math.round(v).toLocaleString("en-US")}`);
const pct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

const TABS = ["전체", "국내", "해외", "ISA", "연금"];
const PERIODS = [
  { m: 24, label: "2년" },
  { m: 12, label: "1년" },
  { m: 6, label: "6개월" },
];

console.log("======================================================================");
console.log(" 역산 성과 분석 검증 리포트 (합성 시세 · 현재 평가액 ≈ 6억)");
console.log("======================================================================\n");

for (const tab of TABS) {
  console.log(`### 계좌: ${tab}`);
  for (const p of PERIODS) {
    const r = run(tab, p.m);
    if (!r.available) {
      console.log(`  - ${p.label}: (데이터 없음: ${r.unavailableReason ?? ""})`);
      continue;
    }
    const c = r.cards.portfolio;
    const lastPoint = r.points[r.points.length - 1];
    // [핵심] 그래프 마지막 값 == 카드 현재가치.
    assert.equal(lastPoint.portfolio, c.currentValueKRW, `${tab}/${p.label}: 그래프 마지막 != 카드 현재가치`);
    assert.ok(r.basePrincipalKRW <= c.currentValueKRW + 1, `${tab}/${p.label}: 원금이 현재가치보다 큼`);
    console.log(
      `  - ${p.label.padEnd(3)} | 현재가치 ${won(c.currentValueKRW).padStart(16)} | 원금 ${won(r.basePrincipalKRW).padStart(16)} | 수익률 ${pct(c.returnPct).padStart(7)} | 그래프말단 ${won(lastPoint.portfolio).padStart(16)} ✓일치`,
    );
  }
  // 기간별 원금 단조성(2년 < 1년 < 6개월) 확인 — 우상향 시장 가정.
  const p24 = run(tab, 24).basePrincipalKRW;
  const p12 = run(tab, 12).basePrincipalKRW;
  const p6 = run(tab, 6).basePrincipalKRW;
  console.log(`    기간별 원금: 2년 ${won(p24)} < 1년 ${won(p12)} < 6개월 ${won(p6)}  → ${p24 < p12 && p12 < p6 ? "단조 증가 ✓" : "확인필요"}`);
  console.log("");
}

// ---- SVG 차트 아티팩트 생성 (전체/2년) : 그래프 마지막 값 == 카드 현재가치 시각 확인 ----
const full = run("전체", 24);
function buildSvg(result, title) {
  const W = 900;
  const H = 460;
  const padL = 70;
  const padR = 24;
  const padT = 56;
  const padB = 40;
  const pts = result.points;
  const keys = [
    { k: "portfolio", color: "#3b82f6", name: "내 포트폴리오", w: 2.6 },
    { k: "spy", color: "#10b981", name: "SPY 투자 시", w: 1.6 },
    { k: "qqq", color: "#f97316", name: "QQQ 투자 시", w: 1.6 },
    { k: "custom", color: "#a855f7", name: "SCHD 투자 시", w: 1.6 },
  ];
  const all = [];
  for (const p of pts) for (const { k } of keys) if (typeof p[k] === "number") all.push(p[k]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const x = (i) => padL + (i / (pts.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);
  let body = "";
  for (const { k, color, w } of keys) {
    let d = "";
    pts.forEach((p, i) => {
      if (typeof p[k] !== "number") return;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)} `;
    });
    body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-dasharray="${k === "portfolio" ? "0" : "5 4"}"/>`;
  }
  // 포트폴리오 마지막 점 강조 + 라벨.
  const lastV = result.cards.portfolio.currentValueKRW;
  const lx = x(pts.length - 1);
  const ly = y(lastV);
  body += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5" fill="#3b82f6"/>`;
  const eok = (v) => `${(v / 100000000).toFixed(2)}억`;
  body += `<text x="${(lx - 6).toFixed(1)}" y="${(ly - 12).toFixed(1)}" font-size="13" fill="#1d4ed8" text-anchor="end" font-weight="700">그래프 말단 = ${eok(lastV)} (${won(lastV)})</text>`;
  // 카드 요약 박스.
  const card = result.cards.portfolio;
  body += `<text x="${padL}" y="24" font-size="16" font-weight="800" fill="#0f172a">${title}</text>`;
  body += `<text x="${padL}" y="44" font-size="12.5" fill="#475569">카드 현재가치 ${won(card.currentValueKRW)} · 원금 ${won(result.basePrincipalKRW)} · 수익률 ${pct(card.returnPct)} · (그래프 말단과 100% 일치)</text>`;
  // 범례.
  let lgx = W - padR - 360;
  keys.forEach(({ color, name }) => {
    body += `<rect x="${lgx}" y="${H - 20}" width="14" height="4" fill="${color}"/><text x="${lgx + 18}" y="${H - 16}" font-size="11" fill="#475569">${name}</text>`;
    lgx += 92;
  });
  // y축 눈금.
  for (let g = 0; g <= 4; g += 1) {
    const v = min + ((max - min) * g) / 4;
    const gy = y(v);
    body += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`;
    body += `<text x="${padL - 8}" y="${(gy + 4).toFixed(1)}" font-size="10.5" fill="#94a3b8" text-anchor="end">${eok(v)}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${body}</svg>`;
}
const svg = buildSvg(full, "전체 계좌 · 2년 역산 성과 분석 (검증용 합성 시세)");
const outPath = path.join(rootDir, "docs", "backtest-verification-chart.svg");
fs.writeFileSync(outPath, svg, "utf8");
console.log(`SVG 차트 아티팩트 생성: ${path.relative(rootDir, outPath)}`);
console.log("\n모든 검증 통과 ✅");
