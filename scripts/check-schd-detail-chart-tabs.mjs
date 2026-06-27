import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const marketIndexPath = "lib/market-index.ts";
const tabsPath = "lib/schd-detail-tabs.ts";
const modalPath = "components/market/IndexDetailModal.tsx";
const sectionPath = "components/dividend/SchdAttractivenessSection.tsx";
const packagePath = "package.json";

const read = (p) => fs.readFileSync(p, "utf8");

// Load schd-detail-tabs.ts in a sandbox, stubbing out "@/lib/market-index"
// (types only) and "@/lib/market-series" (fetchLongSeries) so the tab/compare/
// spread logic can be exercised without the Next.js bundler.
function loadTabsModule() {
  const source = read(tabsPath)
    .replace(/^import type[^;]+;\n/gm, "")
    .replace(/^import\s+\{[^}]*\}\s+from\s+"@\/lib\/market-index";\n/gm, "")
    .replace(/^import\s+\{[^}]*\}\s+from\s+"@\/lib\/market-series";\n/gm, "");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: tabsPath,
  }).outputText;

  // Fake long-series source covering ^TNX (US10Y), SPY and SCHD (Compare).
  const fetchLongSeries = async (symbol, _start) => {
    if (symbol === "^TNX") {
      return {
        symbol,
        points: [
          { date: "2019-12-02", close: 4.3, adjClose: 4.3 },
          { date: "2020-01-02", close: 4.4, adjClose: 4.4 },
          { date: "2020-01-03", close: 4.45, adjClose: 4.45 },
          { date: "2020-01-06", close: 4.5, adjClose: 4.5 },
        ],
        dividends: [],
      };
    }
    // SPY / SCHD: shared trading dates, one dividend each.
    return {
      symbol,
      points: [
        { date: "2020-01-02", close: 100, adjClose: 100 },
        { date: "2020-01-03", close: 100, adjClose: 100 },
        { date: "2020-01-06", close: 110, adjClose: 110 },
      ],
      dividends: [{ date: "2020-01-03", amount: symbol === "SCHD" ? 10 : 2 }],
    };
  };

  const sandbox = { exports: {}, module: { exports: {} }, require, console, fetchLongSeries };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(output, sandbox, { filename: tabsPath });
  return sandbox.module.exports;
}

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error });
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error });
  }
}

const mod = loadTabsModule();

// ---- Static source assertions -------------------------------------------------

check("1) market-index exposes DetailLineTab / DetailLinePoint / DetailLineSeries types", () => {
  const src = read(marketIndexPath);
  assert.match(src, /export type DetailLineTab/);
  assert.match(src, /export type DetailLinePoint/);
  assert.match(src, /export type DetailLineSeries/);
  assert.match(src, /resolveMulti\?:/);
  assert.match(src, /normalizeToStart\?:/);
});

check("2) US10Y uses ^TNX over the FULL daily history via fetchLongSeries", () => {
  const src = read(tabsPath);
  assert.match(src, /US10Y_SYMBOL\s*=\s*"\^TNX"/);
  assert.match(src, /fetchLongSeries\(US10Y_SYMBOL/);
});

check("3) tab builder defines compare / us10y / spread keys (legacy Dividend tab removed)", () => {
  const src = read(tabsPath);
  for (const key of ['key: "compare"', 'key: "us10y"', 'key: "spread"']) {
    assert.ok(src.includes(key), `missing ${key}`);
  }
  assert.ok(!src.includes('key: "dividend"'), "Dividend tab should be removed");
});

check("4) Spread tab uses a zero baseline", () => {
  assert.match(read(tabsPath), /key: "spread"[\s\S]*zeroBaseline: true/);
});

check("5) Compare tab is multi-line + normalized to the range start", () => {
  const src = read(tabsPath);
  assert.match(src, /key: "compare"[\s\S]*normalizeToStart: true/);
  assert.match(src, /key: "compare"[\s\S]*resolveMulti:/);
});

check("6) Compare uses after-tax (WHT) dividend-reinvested total return", () => {
  const src = read(tabsPath);
  assert.match(src, /DIVIDEND_WITHHOLDING_TAX\s*=\s*0\.15/);
  assert.match(src, /buildTotalReturnIndex/);
});

check("7) tab colors use project tokens (us10y blue, spread purple)", () => {
  const src = read(tabsPath);
  assert.match(src, /#3b82f6/);
  assert.match(src, /#8b5cf6/);
});

check("8) modal accepts opt-in lineTabs and renders a tab bar only when provided", () => {
  const src = read(modalPath);
  assert.match(src, /lineTabs\?:\s*DetailLineTab\[\]/);
  assert.match(src, /hasTabs\s*&&/);
});

check("9) modal keeps candlestick Price behavior (MA toggles + applyVisibleRange on price tab)", () => {
  const src = read(modalPath);
  assert.match(src, /isPriceTab\s*&&\s*\(/);
  assert.match(src, /if \(isPriceTab\) \{[\s\S]*applyVisibleRange/);
});

check("10) modal supports multi-line tabs + fills the X-axis via setVisibleRange", () => {
  const src = read(modalPath);
  assert.match(src, /isMultiTab/);
  assert.match(src, /resolveMulti/);
  assert.match(src, /setVisibleRange/);
});

check("11) modal does not re-resolve line data on range change (cache by tab key)", () => {
  const src = read(modalPath);
  assert.match(src, /lineCacheRef/);
  assert.match(src, /multiCacheRef/);
  assert.match(src, /\}, \[activeLineTab\]\);/);
});

check("12) section passes lineTabs and reuses the main TTM yield series", () => {
  const src = read(sectionPath);
  assert.match(src, /buildSchdDetailLineTabs/);
  assert.match(src, /lineTabs=\{detailLineTabs\}/);
  assert.match(src, /dividendYieldSeries[\s\S]*ttmYield/);
});

check("13) npm script registered", () => {
  const pkg = JSON.parse(read(packagePath));
  assert.equal(pkg.scripts["check:schd-detail-chart-tabs"], "node scripts/check-schd-detail-chart-tabs.mjs");
});

// ---- Behavioral assertions ----------------------------------------------------

check("14) computeSpreadSeries = dividend - us10y, forward-filled and signed", () => {
  const dividend = [
    { date: "2026-06-24", value: 3.6 },
    { date: "2026-06-25", value: 3.5 },
  ];
  const us10y = [
    { date: "2026-06-24", value: 4.45 },
    { date: "2026-06-25", value: 4.5 },
  ];
  const spread = mod.computeSpreadSeries(dividend, us10y);
  assert.equal(spread.length, 2);
  assert.equal(Number(spread[0].value.toFixed(2)), -0.85);
  assert.equal(Number(spread[1].value.toFixed(2)), -1.0);
});

check("15) computeSpreadSeries forward-fills US10Y on missing trading days", () => {
  const dividend = [
    { date: "2026-06-24", value: 3.6 },
    { date: "2026-06-26", value: 3.4 },
  ];
  const us10y = [
    { date: "2026-06-24", value: 4.4 },
    { date: "2026-06-25", value: 4.5 },
  ];
  const spread = mod.computeSpreadSeries(dividend, us10y);
  assert.equal(spread.length, 2);
  assert.equal(Number(spread[1].value.toFixed(2)), -1.1);
});

check("16) buildTotalReturnIndex reinvests AFTER-TAX dividends at the ex-date close", () => {
  const points = [
    { date: "2020-01-02", close: 100, adjClose: 100 },
    { date: "2020-01-03", close: 100, adjClose: 100 },
  ];
  const dividends = [{ date: "2020-01-03", amount: 10 }];
  const tr = mod.buildTotalReturnIndex(points, dividends, 0.15);
  assert.equal(tr.length, 2);
  assert.equal(Number(tr[0].value.toFixed(2)), 100);
  // 1 share + (10*0.85)/100 reinvested = 1.085 shares * 100 = 108.5
  assert.equal(Number(tr[1].value.toFixed(2)), 108.5);
  // After-tax must be strictly below the pre-tax (110) reinvestment.
  const trGross = mod.buildTotalReturnIndex(points, dividends, 0);
  assert.equal(Number(trGross[1].value.toFixed(2)), 110);
  assert.ok(tr[1].value < trGross[1].value);
});

await checkAsync("17) buildSchdDetailLineTabs resolves compare(multi) + us10y + spread", async () => {
  const dividend = [
    { date: "2020-01-02", value: 3.6 },
    { date: "2020-01-03", value: 3.5 },
    { date: "2020-01-06", value: 3.4 },
  ];
  const tabs = mod.buildSchdDetailLineTabs(dividend);
  assert.equal(tabs.map((t) => t.key).join(","), "compare,us10y,spread");

  // Compare: multi-line SPY + SCHD, aligned on shared dates.
  const compare = await tabs[0].resolveMulti();
  assert.equal(compare.map((s) => s.key).join(","), "spy,schd");
  assert.ok(compare[0].points.length === compare[1].points.length && compare[0].points.length > 0);
  assert.equal(compare[0].points[0].date, compare[1].points[0].date); // identical start date

  // US10Y: clipped to the dividend start (forward-fill source is fetched earlier).
  const us10y = await tabs[1].resolve();
  assert.ok(us10y.length >= 1);
  assert.ok(us10y.every((p) => p.date >= dividend[0].date));

  // Spread: dividend - us10y over the full dividend range.
  const spread = await tabs[2].resolve();
  assert.ok(spread.length >= 1);
});

for (const c of checks) console.log(`${c.ok ? "✅" : "❌"} ${c.name}`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  for (const c of failed) console.error(c.error?.stack || c.error);
  process.exit(1);
}
console.log("SCHD detail chart tabs checks passed.");
