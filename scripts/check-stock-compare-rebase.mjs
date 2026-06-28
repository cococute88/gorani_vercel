#!/usr/bin/env node

// =============================================================
// 성과 비교 차트 "표시 기준점(0%) 재설정" 회귀 검증.
//
// 검증 포인트
//   1) anchor=null → 원본 시리즈 그대로(기간 기준).
//   2) anchor 지정 시 해당 날짜가 모든 시리즈에서 정확히 0% 가 된다.
//   3) 재기준화 후에도 두 점 사이의 "구간 수익률(상대 성과)"은 보존된다
//      (선형 인덱스 재기준화의 핵심 성질).
//   4) resolveAnchorDate 는 보이는 첫 날짜(fromDate) 이상 최초 데이터 날짜를 고른다.
//   5) 원본 데이터(points)는 변형되지 않는다(불변성).
//   6) 중복 제거 시리즈(aEx/bEx)도 동일 anchor 로 0% 가 된다.
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
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { rebaseCompareSeries, resolveAnchorDate, valueAsOf } = require("../lib/stock-compare/rebase.ts");

const APPROX = 1e-6;
const approx = (a, b) => Math.abs(a - b) <= APPROX;
// rebaseCompareSeries 는 표시값을 소수 4자리로 반올림하므로 비교는 그보다 느슨하게.
const approxRounded = (a, b) => Math.abs(a - b) <= 1e-3;

// 누적수익률(%) → 인덱스 비율(1 + v/100)로 변환 후 비교용 헬퍼.
const ratio = (v) => 1 + v / 100;

// 샘플: SPY(a) / QQQ(b) 와 중복 제거 시리즈(aEx/bEx). MAX 기준 누적수익률(%) 가정.
function sampleSeries() {
  return [
    {
      key: "a",
      label: "SPY",
      color: "#3b82f6",
      overlapAdjusted: false,
      available: true,
      points: [
        { date: "2020-01-02", value: 0 },
        { date: "2021-01-04", value: 50 },
        { date: "2023-01-03", value: 200 },
        { date: "2024-01-02", value: 300 },
      ],
    },
    {
      key: "b",
      label: "QQQ",
      color: "#ec4899",
      overlapAdjusted: false,
      available: true,
      points: [
        { date: "2020-01-02", value: 0 },
        { date: "2021-01-04", value: 80 },
        { date: "2023-01-03", value: 400 },
        { date: "2024-01-02", value: 600 },
      ],
    },
    {
      key: "aEx",
      label: "SPY (중복 제거)",
      color: "#0ea5e9",
      overlapAdjusted: true,
      available: true,
      points: [
        { date: "2020-01-02", value: 0 },
        { date: "2021-01-04", value: 40 },
        { date: "2023-01-03", value: 150 },
        { date: "2024-01-02", value: 220 },
      ],
    },
    {
      key: "bEx",
      label: "QQQ (중복 제거)",
      color: "#f59e0b",
      overlapAdjusted: true,
      available: true,
      points: [
        { date: "2020-01-02", value: 0 },
        { date: "2021-01-04", value: 60 },
        { date: "2023-01-03", value: 300 },
        { date: "2024-01-02", value: 450 },
      ],
    },
  ];
}

function assertNullAnchorIsIdentity() {
  const series = sampleSeries();
  const out = rebaseCompareSeries(series, null);
  assert.equal(out, series, "anchor=null 이면 원본 배열을 그대로 반환해야 한다");
  return { case: "anchor=null → identity" };
}

function assertAnchorBecomesZero() {
  const series = sampleSeries();
  const anchor = "2023-01-03";
  const out = rebaseCompareSeries(series, anchor);
  for (const s of out) {
    const at = s.points.find((p) => p.date === anchor);
    assert.ok(at, `${s.key}: anchor 날짜 포인트 존재`);
    assert.ok(approx(at.value, 0), `${s.key}: anchor 시점은 0% 여야 함 (got ${at.value})`);
  }
  return { case: "anchor → 0% (all series incl. aEx/bEx)", anchor };
}

function assertRelativeReturnPreserved() {
  // 재기준화는 구간 상대 성과를 보존한다: (idx_t2/idx_t1) 불변.
  const series = sampleSeries();
  const out = rebaseCompareSeries(series, "2023-01-03");
  for (let i = 0; i < series.length; i += 1) {
    const before = series[i].points;
    const after = out[i].points;
    // 2023 → 2024 구간 성장비
    const bRatio = ratio(before[3].value) / ratio(before[2].value);
    const aRatio = ratio(after[3].value) / ratio(after[2].value);
    assert.ok(approxRounded(bRatio, aRatio), `${series[i].key}: 구간 상대 성과 보존 (${bRatio} vs ${aRatio})`);
  }
  // SPY: 2023(0%) → 2024 는 +33.33% (300→300% 누적: 4.0/3.0 = 1.3333)
  const a = out.find((s) => s.key === "a");
  assert.ok(approxRounded(a.points[3].value, (4 / 3 - 1) * 100), `SPY 2024 재기준 값 = +33.33% (got ${a.points[3].value})`);
  return { case: "relative return preserved", spy2024: a.points[3].value };
}

function assertResolveAnchorDate() {
  const series = sampleSeries();
  // 정확히 존재하는 날짜
  assert.equal(resolveAnchorDate(series, "2023-01-03"), "2023-01-03");
  // 사이 날짜 → 그 이상 최초 데이터 날짜
  assert.equal(resolveAnchorDate(series, "2022-06-01"), "2023-01-03");
  // 첫 날짜 이전 → 첫 데이터 날짜
  assert.equal(resolveAnchorDate(series, "2019-01-01"), "2020-01-02");
  // 마지막 날짜 이후 → 데이터 없음 → fromDate 그대로
  assert.equal(resolveAnchorDate(series, "2030-01-01"), "2030-01-01");
  return { case: "resolveAnchorDate picks first data date >= fromDate" };
}

function assertValueAsOf() {
  const pts = sampleSeries()[0].points;
  assert.equal(valueAsOf(pts, "2023-01-03"), 200); // 정확히 존재
  assert.equal(valueAsOf(pts, "2022-06-01"), 50); // 이전 마지막(2021) = 50
  assert.equal(valueAsOf(pts, "2019-01-01"), 0); // anchor 이전 없음 → 첫 점
  return { case: "valueAsOf forward-fill semantics" };
}

function assertImmutability() {
  const series = sampleSeries();
  const snapshot = JSON.parse(JSON.stringify(series));
  rebaseCompareSeries(series, "2023-01-03");
  assert.deepEqual(series, snapshot, "원본 시리즈/포인트는 변형되지 않아야 한다");
  return { case: "original data immutable" };
}

function main() {
  const rows = [
    assertNullAnchorIsIdentity(),
    assertAnchorBecomesZero(),
    assertRelativeReturnPreserved(),
    assertResolveAnchorDate(),
    assertValueAsOf(),
    assertImmutability(),
  ];
  console.log("Stock-compare rebase (0% baseline reset) regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("Stock-compare rebase regression failed.");
  console.error(error);
  process.exit(1);
}
