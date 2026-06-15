#!/usr/bin/env node

// ASSET-PORTFOLIO-UX-POLISH-1 regression guard.
// Verifies the asset-simulator input UX, portfolio treemap proportion/filter/
// color/label rules, top-holdings Korean labels, and light/dark scrollbar CSS.

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
    return originalResolveFilename.call(
      this,
      path.join(rootDir, request.slice(2)),
      parent,
      isMain,
      options,
    );
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

const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), "utf8");

const { holdingDisplayLabel, isNumericKrxTicker } = require("@/lib/holding-display-label.ts");
const { treemapColorCategory, TREEMAP_CATEGORY_CLASSES } = require("@/lib/treemap-color.ts");
const {
  buildPortfolioPageFromSnapshot,
  TREEMAP_MIN_WEIGHT_PCT,
} = require("@/lib/portfolio-from-snapshots.ts");

function holding(partial) {
  return {
    id: partial.id,
    broker: partial.broker ?? "테스트증권",
    assetType: partial.assetType ?? "ETF",
    productName: partial.productName ?? partial.id,
    cleanName: partial.cleanName,
    ticker: partial.ticker,
    principalKRW: partial.principalKRW ?? partial.valueKRW,
    valueKRW: partial.valueKRW,
    purposeGroup: partial.purposeGroup,
    statusGroup: partial.statusGroup,
  };
}

function snapshotOf(holdings) {
  const investmentValueKRW = holdings.reduce((sum, h) => sum + h.valueKRW, 0);
  const investmentPrincipalKRW = holdings.reduce((sum, h) => sum + h.principalKRW, 0);
  return {
    id: "snap-test",
    snapshotDate: "2026-06-15",
    sourceFileName: "test.xlsx",
    totalAssetKRW: investmentValueKRW,
    totalDebtKRW: 0,
    netAssetKRW: investmentValueKRW,
    investmentPrincipalKRW,
    investmentValueKRW,
    returnAmountKRW: investmentValueKRW - investmentPrincipalKRW,
    returnPct: 0,
    holdings,
    financeAssets: [],
    createdAt: new Date().toISOString(),
  };
}

// 1. 자산 시뮬레이터 입력 그리드가 desktop 4-column 클래스를 가진다.
function assertSimulatorFourColumnGrid() {
  const source = read("components/asset-simulator/SimulatorInputPanel.tsx");
  assert.ok(
    /grid[^"]*\b(lg|xl):grid-cols-4\b/.test(source),
    "SimulatorInputPanel 은 desktop 4-column(lg/xl:grid-cols-4) 그리드를 써야 한다",
  );
  return { case: "asset simulator 4-column grid", detail: "lg:grid-cols-4" };
}

// 2. Save 버튼이 초기화 버튼 왼쪽에 있다.
function assertSaveLeftOfReset() {
  const source = read("components/asset-simulator/SimulatorInputPanel.tsx");
  const saveIdx = source.search(/>\s*Save\s*</);
  const resetIdx = source.indexOf("초기화");
  assert.ok(saveIdx !== -1, "Save 버튼이 있어야 한다");
  assert.ok(/onClick=\{handleSave\}/.test(source), "Save 버튼은 onSave 저장 핸들러에 연결돼야 한다");
  assert.ok(resetIdx !== -1, "초기화 버튼이 있어야 한다");
  assert.ok(saveIdx < resetIdx, "Save 버튼은 초기화 버튼 왼쪽(앞)에 있어야 한다");
  return { case: "Save left of 초기화", detail: `save@${saveIdx} < reset@${resetIdx}` };
}

// 3. 트리맵은 전체 평가금액 대비 2% 미만 종목을 표시에서 제외한다(랭킹/요약은 유지).
function assertTreemapExcludesBelowTwoPercent() {
  assert.equal(TREEMAP_MIN_WEIGHT_PCT, 2, "트리맵 최소 비중 기준은 2% 여야 한다");
  const holdings = [
    holding({ id: "big", cleanName: "TQQQ", ticker: "TQQQ", valueKRW: 985 }),
    holding({ id: "small", cleanName: "소형ETF", ticker: "SMALL", valueKRW: 15 }),
  ];
  const model = buildPortfolioPageFromSnapshot(snapshotOf(holdings));
  const treemapTickers = model.treemapItems.map((item) => item.ticker);
  assert.ok(treemapTickers.includes("TQQQ"), "큰 비중(TQQQ)은 트리맵에 남아야 한다");
  assert.ok(!treemapTickers.includes("SMALL"), "2% 미만(1.5%)은 트리맵에서 제외돼야 한다");
  const rankingTickers = model.holdingsRankingRows.map((item) => item.ticker);
  assert.ok(rankingTickers.includes("SMALL"), "랭킹/요약 데이터는 2% 미만 종목도 유지해야 한다");
  return { case: "treemap excludes < 2%", detail: `treemap=${treemapTickers.length}, ranking=${rankingTickers.length}` };
}

// 4. 트리맵 라벨이 KRX 숫자 티커를 한글 상품명으로 표시한다.
function assertTreemapKoreanLabel() {
  assert.ok(isNumericKrxTicker("360200.KS"), "360200.KS 는 KRX 숫자 티커여야 한다");
  assert.ok(!isNumericKrxTicker("TQQQ"), "TQQQ 는 숫자 티커가 아니다");
  const label = holdingDisplayLabel({ name: "360200.KS", ticker: "360200.KS" });
  assert.ok(!/^\d{6}(\.(KS|KQ))?$/.test(label), `숫자 티커가 라벨로 그대로 노출되면 안 된다: ${label}`);
  assert.ok(/[가-힣]/.test(label), `KRX 숫자 티커는 한글 상품명으로 치환돼야 한다: ${label}`);
  // cleanName 이 있으면 그것을 우선한다.
  assert.equal(
    holdingDisplayLabel({ name: "미래연금ACE미국나스닥100", ticker: "367380.KS" }),
    "미래연금ACE미국나스닥100",
  );
  return { case: "treemap KRX→Korean label", detail: label };
}

// 5. 종목별 비중 상위 라벨도 KRX 숫자 티커를 한글로 표시한다.
function assertTopHoldingsKoreanLabel() {
  const holdings = [
    holding({ id: "krx", productName: "360200.KS", ticker: "360200.KS", valueKRW: 600 }),
    holding({ id: "us", cleanName: "TQQQ", ticker: "TQQQ", valueKRW: 400 }),
  ];
  const model = buildPortfolioPageFromSnapshot(snapshotOf(holdings));
  const names = model.stockAllocation.map((slice) => slice.name);
  assert.ok(
    names.every((name) => !/^\d{6}(\.(KS|KQ))?$/.test(name)),
    `종목별 비중 상위 라벨에 숫자 티커가 남으면 안 된다: ${JSON.stringify(names)}`,
  );
  assert.ok(
    names.some((name) => /[가-힣]/.test(name)),
    "KRX 종목은 한글 상품명으로 표시돼야 한다",
  );
  return { case: "top holdings KRX→Korean label", detail: JSON.stringify(names) };
}

// 6. 트리맵 색상 카테고리: 나스닥/red, 현금/green, SPY·SCHD·MSFT/yellow, 기타/blue.
function assertTreemapColorCategory() {
  assert.equal(treemapColorCategory({ name: "TQQQ", ticker: "TQQQ" }), "nasdaq");
  assert.equal(treemapColorCategory({ name: "ACE 미국나스닥100", ticker: "367380.KS" }), "nasdaq");
  assert.equal(treemapColorCategory({ name: "현금성 예수금", ticker: "" }), "cash");
  assert.equal(treemapColorCategory({ name: "SGOV", ticker: "SGOV" }), "cash");
  assert.equal(treemapColorCategory({ name: "SPY", ticker: "SPY" }), "sp");
  assert.equal(treemapColorCategory({ name: "SCHD", ticker: "SCHD" }), "sp");
  assert.equal(treemapColorCategory({ name: "MSFT", ticker: "MSFT" }), "sp");
  assert.equal(treemapColorCategory({ name: "삼성전자", ticker: "005930.KS" }), "other");
  return { case: "treemap color category", detail: "nasdaq/cash/sp/other" };
}

// 7. 라이트모드 트리맵 색상 클래스는 연한(100~200) 톤 + slate-900 텍스트.
function assertLightModeSoftColors() {
  for (const [category, styles] of Object.entries(TREEMAP_CATEGORY_CLASSES)) {
    assert.ok(
      /bg-(red|green|yellow|blue)-(100|200)\b/.test(styles.light),
      `${category} 라이트 배경은 연한 100~200 톤이어야 한다: ${styles.light}`,
    );
    assert.ok(
      styles.light.includes("text-slate-900"),
      `${category} 라이트 텍스트는 slate-900 이어야 한다: ${styles.light}`,
    );
    assert.ok(
      !/bg-(red|green|yellow|amber|emerald|blue)-(500|600|700|800|900)/.test(styles.light),
      `${category} 라이트 배경에 진한 톤이 섞이면 안 된다: ${styles.light}`,
    );
    assert.ok(styles.dark.includes("text-white"), `${category} 다크 텍스트는 흰색이어야 한다`);
  }
  return { case: "light mode soft treemap colors", detail: "100~200 + slate-900" };
}

// 8. 전역 스크롤바 CSS 가 light/dark 로 분기하고, 라이트 스크롤바가 검은색이 아니다.
function assertScrollbarThemeSeparation() {
  const css = read("app/globals.css");
  assert.ok(css.includes(".scroll-light"), "scroll-light 클래스가 있어야 한다");
  assert.ok(css.includes(".scroll-dark"), "scroll-dark 클래스가 있어야 한다");
  assert.ok(
    /\.light\s+\.scroll-dark/.test(css),
    "라이트모드에서 scroll-dark 를 밝게 분기하는 규칙이 있어야 한다",
  );
  // 라이트 스크롤바 thumb 가 검은색/거의 검은색이 아니어야 한다.
  const lightThumb = "#cbd5e1";
  assert.ok(css.includes(lightThumb), `라이트 스크롤바 thumb 은 밝은 회색(${lightThumb})이어야 한다`);
  const lightBlock = css.slice(css.indexOf(".light .scroll-dark"));
  assert.ok(
    !/\.light\s+\.scroll-dark[^}]*background:\s*#(000000|000|111|222|2f3a3d)/i.test(lightBlock),
    "라이트모드 scroll-dark 가 검은색으로 남으면 안 된다",
  );
  return { case: "scrollbar light/dark separation", detail: "light=#cbd5e1" };
}

function main() {
  const rows = [
    assertSimulatorFourColumnGrid(),
    assertSaveLeftOfReset(),
    assertTreemapExcludesBelowTwoPercent(),
    assertTreemapKoreanLabel(),
    assertTopHoldingsKoreanLabel(),
    assertTreemapColorCategory(),
    assertLightModeSoftColors(),
    assertScrollbarThemeSeparation(),
  ];
  console.log("Asset/Portfolio UX polish regression passed.");
  console.table(rows);
}

try {
  main();
} catch (error) {
  console.error("Asset/Portfolio UX polish regression failed.");
  console.error(error);
  process.exit(1);
}
